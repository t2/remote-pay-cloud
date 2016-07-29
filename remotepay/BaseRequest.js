/**
 * Autogenerated by Avro
 * 
 * DO NOT EDIT DIRECTLY
 */

// Prototype.js required
require("prototype");

/** The base for requests */
  /**
  * @constructor
  * @memberof remotepay
  */
  BaseRequest = Class.create( {
    /**
    * Initialize the values for this.
    * @memberof remotepay.BaseRequest
    * @private
    */
    initialize: function() {
      this._class_ = BaseRequest;
      this.requestId = undefined;
    },

    /**
    * Set the field value
    * Identifier for the request
    *
    * @memberof remotepay.BaseRequest
    * @param {String|Null} requestId 
    */
    setRequestId: function(requestId) {
      this.requestId = requestId;
    },

    /**
    * Get the field value
    * Identifier for the request
    * @memberof remotepay.BaseRequest
    * @return {String|Null} 
    */
    getRequestId: function() {
      return this.requestId;
    },

    /**
    * @memberof remotepay.BaseRequest
    * @private
    */
    getMetaInfo: function(fieldName) {
      var curclass = this._class_;
      do {
        var fieldMetaInfo = curclass._meta_.fields[fieldName];
        if(fieldMetaInfo) {
          return fieldMetaInfo;
        }
        curclass = curclass.superclass;
      } while(curclass);
      return null;
    },

    toString: function() {
      return JSON.stringify(this);
    }

  });

BaseRequest._meta_ =  {fields:  {}};
BaseRequest._meta_.fields["requestId"] = {};
BaseRequest._meta_.fields["requestId"].type = String;

//
// Expose the module.
//
if ('undefined' !== typeof module) {
module.exports = BaseRequest;
}
