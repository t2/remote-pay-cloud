/**
 * Autogenerated by Avro
 * 
 * DO NOT EDIT DIRECTLY
 */

// Prototype.js required
require("prototype");
var base_Reference = require("../base/Reference");

  /**
  * @constructor
  * @memberof payments
  */
  ServiceChargeAmount = Class.create( {
    /**
    * Initialize the values for this.
    * @memberof payments.ServiceChargeAmount
    * @private
    */
    initialize: function() {
      this._class_ = ServiceChargeAmount;
      this.id = undefined;
      this.name = undefined;
      this.amount = undefined;
      this.paymentRef = undefined;
    },

    /**
    * Set the field value
    * @memberof payments.ServiceChargeAmount
    * @param {String} id 
    */
    setId: function(id) {
      this.id = id;
    },

    /**
    * Get the field value
    * @memberof payments.ServiceChargeAmount
    * @return {String} 
    */
    getId: function() {
      return this.id;
    },

    /**
    * Set the field value
    * @memberof payments.ServiceChargeAmount
    * @param {String} name 
    */
    setName: function(name) {
      this.name = name;
    },

    /**
    * Get the field value
    * @memberof payments.ServiceChargeAmount
    * @return {String} 
    */
    getName: function() {
      return this.name;
    },

    /**
    * Set the field value
    * @memberof payments.ServiceChargeAmount
    * @param {Number} amount must be a long integer
    */
    setAmount: function(amount) {
      this.amount = amount;
    },

    /**
    * Get the field value
    * @memberof payments.ServiceChargeAmount
    * @return {Number} must be a long integer
    */
    getAmount: function() {
      return this.amount;
    },

    /**
    * Set the field value
    * The payment with which the payment tax rate is associated
    *
    * @memberof payments.ServiceChargeAmount
    * @param {base.Reference} paymentRef 
    */
    setPaymentRef: function(paymentRef) {
      this.paymentRef = paymentRef;
    },

    /**
    * Get the field value
    * The payment with which the payment tax rate is associated
    * @memberof payments.ServiceChargeAmount
    * @return {base.Reference} 
    */
    getPaymentRef: function() {
      return this.paymentRef;
    },

    /**
    * @memberof payments.ServiceChargeAmount
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

ServiceChargeAmount._meta_ =  {fields:  {}};
ServiceChargeAmount._meta_.fields["id"] = {};
ServiceChargeAmount._meta_.fields["id"].type = String;
ServiceChargeAmount._meta_.fields["name"] = {};
ServiceChargeAmount._meta_.fields["name"].type = String;
ServiceChargeAmount._meta_.fields["amount"] = {};
ServiceChargeAmount._meta_.fields["amount"].type = Number;
ServiceChargeAmount._meta_.fields["paymentRef"] = {};
ServiceChargeAmount._meta_.fields["paymentRef"].type = base_Reference;

//
// Expose the module.
//
if ('undefined' !== typeof module) {
module.exports = ServiceChargeAmount;
}
