'use strict';
var CRMWebAPI = (function () {
  function CRMWebAPI(config) {
    this.config = config;
    if (typeof module !== 'undefined' && module.exports) {
      this.https = require('https');
      this.urllib = require('url');
      this._GetHttpRequest = this._GetHttpRequestHTTPS;
    } else {
      this._GetHttpRequest = this._GetHttpRequestXMLHTTPRequest;
    }
    return this;
  }
  CRMWebAPI.prototype._restParam = function (func, startIndex) {
    startIndex = startIndex == null ? func.length - 1 : +startIndex;
    return function () {
      var length = Math.max(arguments.length - startIndex, 0);
      var rest = Array(length);
      for (var index = 0; index < length; index++) {
        rest[index] = arguments[index + startIndex];
      }
      switch (startIndex) {
        case 0:
          return func.call(this, rest);
        case 1:
          return func.call(this, arguments[0], rest);
      }
    };
  };
  CRMWebAPI.prototype.whilst = function (test, iterator, callback) {
    if (test()) {
      var next = this._restParam(function (err, args) {
        if (err) {
          callback(err);
        } else if (test.apply(this, args)) {
          iterator(next);
        } else {
          callback.apply(null, [null].concat(args));
        }
      });
      iterator(next);
    } else {
      callback(null);
    }
  };
  CRMWebAPI.prototype.GetList = function (uri, QueryOptions) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var url = CRMWebAPI.prototype._BuildQueryURL(uri, QueryOptions, self.config);
      self._GetHttpRequest(self.config, "GET", url, {
        'headers': self._BuildQueryHeaders(QueryOptions, self.config)
      }, function (err, res) {
        if (err != false) {
          reject(res);
        } else {
          var data = JSON.parse(res.response, CRMWebAPI.prototype._DateReviver);
          var nextLink = data['@odata.nextLink'];
          var recordCount = data['@odata.count'];
          var response = {
            List: data.value,
            Count: 0
          };
          if (nextLink === 'undefined') {
            resolve(response);
          } else {
            self.whilst(function () {
              return (nextLink !== undefined);
            }, function (callback) {
              self._GetHttpRequest(self.config, "GET", nextLink, {
                'headers': self._BuildQueryHeaders(QueryOptions, self.config)
              }, function (err, res) {
                if (err == false) {
                  data = JSON.parse(res.response, CRMWebAPI.prototype._DateReviver);
                  nextLink = data['@odata.nextLink'];
                  response.List = response.List.concat(data.value);
                  callback(null, response.List.length);
                } else {
                  callback('err', 0);
                }
              });
            }, function (err, n) {
              resolve(response);
            });
          }
        }
      });
    });
  };
  CRMWebAPI.prototype.Get = function (entityCollection, entityID, QueryOptions) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var url = CRMWebAPI.prototype._BuildQueryURL(entityCollection + "(" + entityID.toString() + ")", QueryOptions, self.config);
      self._GetHttpRequest(self.config, "GET", url, {
        'headers': self._BuildQueryHeaders(QueryOptions, self.config)
      }, function (err, res) {
        if (err != false) {
          reject(res);
        } else {
          var data = JSON.parse(res.response, CRMWebAPI.prototype._DateReviver)
          resolve(data);
        }
      });
    });
  };
  CRMWebAPI.prototype.GetCount = function (uri, QueryOptions) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var url = CRMWebAPI.prototype._BuildQueryURL(uri + "/$count", QueryOptions, self.config);
      self._GetHttpRequest(self.config, "GET", url, {
        'headers': self._BuildQueryHeaders(QueryOptions, self.config)
      }, function (err, res) {
        if (err != false) {
          reject(res);
        } else {
          var data = parseInt(res.response);
          resolve(data);
        }
      });
    });
  };
  CRMWebAPI.prototype.Create = function (entityCollection, data) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var url = self.config.APIUrl + entityCollection;
      self._GetHttpRequest(self.config, "POST", url, {
        'data': JSON.stringify(data)
      }, function (err, res) {
        if (err != false) {
          reject(res);
        } else {
          resolve(/\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/g.exec(res.headers["odata-entityid"])[1]);
        }
      });
    });
  };
  CRMWebAPI.prototype.Update = function (entityCollection, key, data, Upsert) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var url = self.config.APIUrl + entityCollection + '(' + key + ')';
      var payload = {
        "data": JSON.stringify(data),
        "headers": {}
      };
      if (Upsert != null && Upsert == true) payload["headers"]["If-Match"] = "*";
      self._GetHttpRequest(self.config, "POST", url, payload, function (err, res) {
        if (err != false) {
          reject(res);
        } else {
          var response = {
            EntityID: /\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/g.exec(res.headers["odata-entityid"])[1]
          };
          resolve(response);
        }
      });
    });
  };
  CRMWebAPI.prototype.Delete = function (entityCollection, entityID) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var url = self.config.APIUrl + entityCollection + '(' + entityID + ')';
      self._GetHttpRequest(self.config, "DELETE", url, {}, function (err, res) {
        if (err != false) {
          reject(res);
        } else {
          resolve(true);
        }
      });
    });
  };
  CRMWebAPI.prototype.Associate = function (fromEntitycollection, fromEntityID, navProperty, toEntityCollection, toEntityID) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var url = self.config.APIUrl + fromEntitycollection + '(' + fromEntityID + ')/' + navProperty + '/$ref';
      var payload = {
        'data': JSON.stringify({
          '@odata.id': self.config.APIUrl + toEntityCollection + '(' + toEntityID + ')'
        })
      };
      self._GetHttpRequest(self.config, 'POST', url, payload, function (err, res) {
        if (err != false) {
          reject(res);
        } else {
          resolve(true);
        }
      });
    });
  };
  CRMWebAPI.prototype.DeleteAssociation = function (fromEntitycollection, fromEntityID, navProperty, toEntityCollection, toEntityID) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var url = self.config.APIUrl + fromEntitycollection + '(' + fromEntityID + ')/' + navProperty + '/$ref?$id=' + self.config.APIUrl + toEntityCollection + '(' + toEntityID + ')';
      self._GetHttpRequest(self.config, 'DELETE', url, {}, function (err, res) {
        if (err != false) {
          reject(res);
        } else {
          resolve(true);
        }
      });
    });
  };
  CRMWebAPI.prototype.ExecuteFunction = function (functionName, parameters, entityCollection, entityID) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var parmvars = [];
      var parmvalues = [];
      var parmcount = 1;
      if (parameters != null) {
        Object.keys(parameters).forEach(function (key) {
          var val = parameters[key];
          parmvars.push(key + "=" + "@p" + parmcount.toString());
          if (typeof val === 'string' || val instanceof String) parmvalues.push("@p" + parmcount.toString() + "='" + val + "'");
          else parmvalues.push("@p" + parmcount.toString() + "=" + val);
          parmcount++;
        });
      }
      var url = "";
      if (parameters != null) {
        url = self.config.APIUrl + functionName + "(" + parmvars.join(",") + ")?" + parmvalues.join("&");
        if (entityCollection != null) url = self.config.APIUrl + entityCollection + "(" + entityID.toString() + ")" + functionName + "(" + parmvars.join(",") + ")?" + parmvalues.join("&");
      } else {
        url = self.config.APIUrl + functionName + "()";
        if (entityCollection != null) url = self.config.APIUrl + entityCollection + "(" + entityID.toString() + ")" + functionName + "()";
      }
      self._GetHttpRequest(self.config, "GET", url, {}, function (err, res) {
        if (err != false) {
          reject(res);
        } else {
          var data = JSON.parse(res.response, CRMWebAPI.prototype._DateReviver)
          resolve(data);
        }
      });
    });
  };
  CRMWebAPI.prototype.ExecuteAction = function (actionName, data, entityCollection, entityID) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var url = self.config.APIUrl + actionName;
      if (entityCollection != null) url = self.config.APIUrl + entityCollection + "(" + entityID.toString() + ")" + actionName;
      self._GetHttpRequest(self.config, "POST", url, {
        "data": JSON.stringify(data)
      }, function (err, res) {
        if (err != false) {
          reject(res);
        } else {
          var data = JSON.parse(res.response, CRMWebAPI.prototype._DateReviver)
          resolve(data);
        }
      });
    });
  };
  CRMWebAPI.prototype._BuildQueryURL = function (uri, queryOptions, config) {
    var fullurl = config.APIUrl + uri;
    var qs = [];
    if (queryOptions != null) {
      if (queryOptions.Select != null) qs.push("$select=" + queryOptions.Select.join(","));
      if (queryOptions.OrderBy != null) qs.push("$orderby=" + queryOptions.OrderBy.join(","));
      if (queryOptions.Filter != null) qs.push("$filter=" + queryOptions.Filter);
      if (queryOptions.IncludeCount) qs.push("$count=true");
      if (queryOptions.Skip > 0) qs.push("skip=" + queryOptions.Skip);
      if (queryOptions.Top > 0) qs.push("$top=" + queryOptions.Top);
      if (queryOptions.SystemQuery != null) qs.push("savedQuery=" + queryOptions.SystemQuery);
      if (queryOptions.UserQuery != null) qs.push("userQuery=" + queryOptions.UserQuery);
      if (queryOptions.FetchXml != null) qs.push("fetchXml=" + encodeURI(queryOptions.FetchXml));
    }
    if (qs.length > 0) fullurl += "?" + qs.join("&")
    return fullurl;
  };
  CRMWebAPI.prototype._BuildQueryHeaders = function (queryOptions, config) {
    var headers = {};
    if (queryOptions != null) {
      if (queryOptions.FormattedValues == true) headers['odata.include-annotations'] = 'OData.Community.Display.V1.FormattedValue';
    }
    return headers;
  };
  CRMWebAPI.prototype.parseResponseHeaders = function (headerStr) {
    var headers = {};
    if (!headerStr) {
      return headers;
    }
    var headerPairs = headerStr.split('\u000d\u000a');
    for (var i = 0; i < headerPairs.length; i++) {
      var headerPair = headerPairs[i];
      // Can't use split() here because it does the wrong thing
      // if the header value has the string ": " in it.
      var index = headerPair.indexOf('\u003a\u0020');
      if (index > 0) {
        var key = headerPair.substring(0, index);
        var val = headerPair.substring(index + 2);
        headers[key.toLowerCase()] = val;
      }
    }
    return headers;
  };
  CRMWebAPI.prototype._GetHttpRequestXMLHTTPRequest = function (config, method, url, payload, callback) {
    var self = this;
    var req = new XMLHttpRequest();
    req.open(method, encodeURI(url), true);
    if (config.AccessToken != null) req.setRequestHeader("Authorization", "Bearer " + config.AccessToken);
    req.setRequestHeader("Accept", "application/json");
    req.setRequestHeader("OData-MaxVersion", "4.0");
    req.setRequestHeader("OData-Version", "4.0");
    if (config.callerId) req.setRequestHeader("MSCRMCallerID", config.callerId);
    if (['POST', 'PUT', 'PATCH'].indexOf(method) >= 0) {
      req.setRequestHeader("Content-Length", payload.data.length);
      req.setRequestHeader("Content-Type", "application/json");
    }
    if (payload.headers !== 'undefined') {
      for (var name in payload.headers) {
        req.setRequestHeader(name, payload.headers[name]);
      }
    }
    req.onreadystatechange = function () {
      if (this.readyState == 4 /* complete */ ) {
        req.onreadystatechange = null;
        if ((this.status >= 200) && (this.status < 300)) {
          callback(false, {
            'response': this.response,
            'headers': self.parseResponseHeaders(this.getAllResponseHeaders())
          });
        } else {
          callback(true, this)
        }
      }
    };
    if (['POST', 'PUT', 'PATCH'].indexOf(method) >= 0) {
      req.send(payload.data);
    } else {
      req.send();
    }
  };
  CRMWebAPI.prototype._GetHttpRequestHTTPS = function (config, method, url, payload, callback) {
    var parsed_url = this.urllib.parse(url);
    var options = {
      hostname: parsed_url.hostname,
      port: 443,
      path: parsed_url.path,
      method: method,
      headers: {
        "Accept": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
      }
    }
    if (['POST', 'PUT', 'PATCH'].indexOf(method) >= 0) {
      options.headers['Content-Length'] = payload.data.length;
      options.headers['Content-Type'] = 'application/json';
    }
    if (config.callerId) options.headers["MSCRMCallerID"] = config.callerId;
    if (config.AccessToken != null) options.headers["Authorization"] = "Bearer " + config.AccessToken;
    if (payload.headers != undefined) {
      for (var name in payload.headers) {
        options.headers[name] = payload.headers[name];
      }
    }
    var req = this.https.request(options, function (res) {
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        body += chunk;
      })
      res.on('end', function () {
        if ((res.statusCode >= 200) && (res.statusCode < 300)) {
          callback(false, {
            'response': body,
            'headers': res.headers
          });
        } else {
          callback(true, {
            'response': body,
            'headers': res.headers
          });
        }
      });
    });
    req.on('error', function (err) {
      callback(true, err);
    })
    if (['POST', 'PUT', 'PATCH'].indexOf(method) >= 0) {
      req.write(payload.data);
    }
    req.end();
  };
  CRMWebAPI.prototype._DateReviver = function (key, value) {
    var a;
    if (typeof value === 'string') {
      a = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(value);
      if (a) {
        return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4], +a[5], +a[6]));
      }
    }
    return value;
  };
  return CRMWebAPI;
})();
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CRMWebAPI;
  this.CRMWebAPI = CRMWebAPI;
} else {
  this.CRMWebAPI = CRMWebAPI;
}