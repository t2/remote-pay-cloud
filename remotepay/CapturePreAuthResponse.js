/**
 * Autogenerated by Avro
 * 
 * DO NOT EDIT DIRECTLY
 */

// Prototype.js required
require("prototype");
var remotepay_BaseResponse = require("../remotepay/BaseResponse");

/** The result of an attempt to capture a previously made pre auth */
  /**
  * @constructor
  * @augments remotepay.BaseResponse
  * @memberof remotepay
  */
  CapturePreAuthResponse = Class.create(remotepay_BaseResponse, {
    /**
    * Initialize the values for this.
    * @memberof remotepay.CapturePreAuthResponse
    * @private
    */
    initialize: function($super) {
      $super();
      this._class_ = CapturePreAuthResponse;
      this.paymentId = undefined;
      this.amount = undefined;
      this.tipAmount = undefined;
    },

    /**
    * Set the field value
    * Unique identifier for a payment
    *
    * @memberof remotepay.CapturePreAuthResponse
    * @param {String} paymentId 
    */
    setPaymentId: function(paymentId) {
      this.paymentId = paymentId;
    },

    /**
    * Get the field value
    * Unique identifier for a payment
    * @memberof remotepay.CapturePreAuthResponse
    * @return {String} 
    */
    getPaymentId: function() {
      return this.paymentId;
    },

    /**
    * Set the field value
    * Total amount paid
    *
    * @memberof remotepay.CapturePreAuthResponse
    * @param {Number} amount must be a long integer
    */
    setAmount: function(amount) {
      this.amount = amount;
    },

    /**
    * Get the field value
    * Total amount paid
    * @memberof remotepay.CapturePreAuthResponse
    * @return {Number} must be a long integer
    */
    getAmount: function() {
      return this.amount;
    },

    /**
    * Set the field value
    * Included tip
    *
    * @memberof remotepay.CapturePreAuthResponse
    * @param {Number} tipAmount must be a long integer
    */
    setTipAmount: function(tipAmount) {
      this.tipAmount = tipAmount;
    },

    /**
    * Get the field value
    * Included tip
    * @memberof remotepay.CapturePreAuthResponse
    * @return {Number} must be a long integer
    */
    getTipAmount: function() {
      return this.tipAmount;
    }
  });

CapturePreAuthResponse._meta_ =  {fields:  {}};
CapturePreAuthResponse._meta_.fields["paymentId"] = {};
CapturePreAuthResponse._meta_.fields["paymentId"].type = String;
CapturePreAuthResponse._meta_.fields["amount"] = {};
CapturePreAuthResponse._meta_.fields["amount"].type = Number;
CapturePreAuthResponse._meta_.fields["tipAmount"] = {};
CapturePreAuthResponse._meta_.fields["tipAmount"].type = Number;

//
// Expose the module.
//
if ('undefined' !== typeof module) {
module.exports = CapturePreAuthResponse;
}
