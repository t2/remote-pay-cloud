/**
 * Autogenerated by Avro
 * 
 * DO NOT EDIT DIRECTLY
 */

// Prototype.js required
require("prototype");
var remotemessage_Method = require("../remotemessage/Method");
var remotemessage_Message = require("../remotemessage/Message");

  /**
  * @constructor
  */
  CloseoutRequestMessage = Class.create(remotemessage_Message, {
    /**
    * Initialize the values for this.
    * @private
    */
    initialize: function($super) {
      $super();
      this._class_ = CloseoutRequestMessage;
      this.setMethod(remotemessage_Method["CLOSEOUT_REQUEST"]);
      this.allowOpenTabs = undefined;
      this.batchId = undefined;
    },

    /**
    * Set the field value
    * If true then open tabs can still be closed out.
    *
    * @param {Boolean} allowOpenTabs 
    */
    setAllowOpenTabs: function(allowOpenTabs) {
      this.allowOpenTabs = allowOpenTabs;
    },

    /**
    * Get the field value
    * If true then open tabs can still be closed out.
      * @return {Boolean} 
    */
    getAllowOpenTabs: function() {
      return this.allowOpenTabs;
    },

    /**
    * Set the field value
    * Reserved for future use.  Specifies the batch to close.
    *
    * @param {String} batchId 
    */
    setBatchId: function(batchId) {
      this.batchId = batchId;
    },

    /**
    * Get the field value
    * Reserved for future use.  Specifies the batch to close.
      * @return {String} 
    */
    getBatchId: function() {
      return this.batchId;
    }
  });

CloseoutRequestMessage._meta_ =  {fields:  {}};
CloseoutRequestMessage._meta_.fields["allowOpenTabs"] = {};
CloseoutRequestMessage._meta_.fields["allowOpenTabs"].type = Boolean;
CloseoutRequestMessage._meta_.fields["batchId"] = {};
CloseoutRequestMessage._meta_.fields["batchId"].type = String;

//
// Expose the module.
//
if ('undefined' !== typeof module) {
module.exports = CloseoutRequestMessage;
}
