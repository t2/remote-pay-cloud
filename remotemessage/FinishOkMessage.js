/**
 * Autogenerated by Avro
 * 
 * DO NOT EDIT DIRECTLY
 */

// Prototype.js required
require("prototype");
var remotemessage_Method = require("../remotemessage/Method");
var remotemessage_Message = require("../remotemessage/Message");
var payments_Payment = require("../payments/Payment");
var base_Signature = require("../base/Signature");
var payments_Refund = require("../payments/Refund");
var payments_Credit = require("../payments/Credit");

  /**
  * @constructor
  * @augments remotemessage.Message
  * @memberof remotemessage
  */
  FinishOkMessage = Class.create(remotemessage_Message, {
    /**
    * Initialize the values for this.
    * @memberof remotemessage.FinishOkMessage
    * @private
    */
    initialize: function($super) {
      $super();
      this._class_ = FinishOkMessage;
      this.setMethod(remotemessage_Method["FINISH_OK"]);
      this.credit = undefined;
      this.payment = undefined;
      this.refund = undefined;
      this.signature = undefined;
    },

    /**
    * Set the field value
    * A credit
    *
    * @memberof remotemessage.FinishOkMessage
    * @param {payments.Credit} credit 
    */
    setCredit: function(credit) {
      this.credit = credit;
    },

    /**
    * Get the field value
    * A credit
    * @memberof remotemessage.FinishOkMessage
    * @return {payments.Credit} 
    */
    getCredit: function() {
      return this.credit;
    },

    /**
    * Set the field value
    * A payment
    *
    * @memberof remotemessage.FinishOkMessage
    * @param {payments.Payment} payment 
    */
    setPayment: function(payment) {
      this.payment = payment;
    },

    /**
    * Get the field value
    * A payment
    * @memberof remotemessage.FinishOkMessage
    * @return {payments.Payment} 
    */
    getPayment: function() {
      return this.payment;
    },

    /**
    * Set the field value
    * The refund
    *
    * @memberof remotemessage.FinishOkMessage
    * @param {payments.Refund} refund 
    */
    setRefund: function(refund) {
      this.refund = refund;
    },

    /**
    * Get the field value
    * The refund
    * @memberof remotemessage.FinishOkMessage
    * @return {payments.Refund} 
    */
    getRefund: function() {
      return this.refund;
    },

    /**
    * Set the field value
    * A signature
    *
    * @memberof remotemessage.FinishOkMessage
    * @param {base.Signature} signature 
    */
    setSignature: function(signature) {
      this.signature = signature;
    },

    /**
    * Get the field value
    * A signature
    * @memberof remotemessage.FinishOkMessage
    * @return {base.Signature} 
    */
    getSignature: function() {
      return this.signature;
    }
  });

FinishOkMessage._meta_ =  {fields:  {}};
FinishOkMessage._meta_.fields["credit"] = {};
FinishOkMessage._meta_.fields["credit"].type = payments_Credit;
FinishOkMessage._meta_.fields["payment"] = {};
FinishOkMessage._meta_.fields["payment"].type = payments_Payment;
FinishOkMessage._meta_.fields["refund"] = {};
FinishOkMessage._meta_.fields["refund"].type = payments_Refund;
FinishOkMessage._meta_.fields["signature"] = {};
FinishOkMessage._meta_.fields["signature"].type = base_Signature;

//
// Expose the module.
//
if ('undefined' !== typeof module) {
module.exports = FinishOkMessage;
}
