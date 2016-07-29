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
  DCCInfo = Class.create( {
    /**
    * Initialize the values for this.
    * @memberof payments.DCCInfo
    * @private
    */
    initialize: function() {
      this._class_ = DCCInfo;
      this.inquiryRateId = undefined;
      this.dccApplied = undefined;
      this.foreignCurrencyCode = undefined;
      this.foreignAmount = undefined;
      this.exchangeRate = undefined;
      this.marginRatePercentage = undefined;
      this.exchangeRateSourceName = undefined;
      this.exchangeRateSourceTimeStamp = undefined;
      this.paymentRef = undefined;
    },

    /**
    * Set the field value
    * Inquiry Rate ID (IPG)
    *
    * @memberof payments.DCCInfo
    * @param {Number} inquiryRateId must be a long integer
    */
    setInquiryRateId: function(inquiryRateId) {
      this.inquiryRateId = inquiryRateId;
    },

    /**
    * Get the field value
    * Inquiry Rate ID (IPG)
    * @memberof payments.DCCInfo
    * @return {Number} must be a long integer
    */
    getInquiryRateId: function() {
      return this.inquiryRateId;
    },

    /**
    * Set the field value
    * Flag indicating whether DCC was applied on this txn
    *
    * @memberof payments.DCCInfo
    * @param {Boolean} dccApplied 
    */
    setDccApplied: function(dccApplied) {
      this.dccApplied = dccApplied;
    },

    /**
    * Get the field value
    * Flag indicating whether DCC was applied on this txn
    * @memberof payments.DCCInfo
    * @return {Boolean} 
    */
    getDccApplied: function() {
      return this.dccApplied;
    },

    /**
    * Set the field value
    * Foreign currency code
    *
    * @memberof payments.DCCInfo
    * @param {String} foreignCurrencyCode 
    */
    setForeignCurrencyCode: function(foreignCurrencyCode) {
      this.foreignCurrencyCode = foreignCurrencyCode;
    },

    /**
    * Get the field value
    * Foreign currency code
    * @memberof payments.DCCInfo
    * @return {String} 
    */
    getForeignCurrencyCode: function() {
      return this.foreignCurrencyCode;
    },

    /**
    * Set the field value
    * Foreign (transaction) amount
    *
    * @memberof payments.DCCInfo
    * @param {Number} foreignAmount must be a long integer
    */
    setForeignAmount: function(foreignAmount) {
      this.foreignAmount = foreignAmount;
    },

    /**
    * Get the field value
    * Foreign (transaction) amount
    * @memberof payments.DCCInfo
    * @return {Number} must be a long integer
    */
    getForeignAmount: function() {
      return this.foreignAmount;
    },

    /**
    * Set the field value
    * Exchange Rate
    *
    * @memberof payments.DCCInfo
    * @param {Number} exchangeRate must be a double
    */
    setExchangeRate: function(exchangeRate) {
      this.exchangeRate = exchangeRate;
    },

    /**
    * Get the field value
    * Exchange Rate
    * @memberof payments.DCCInfo
    * @return {Number} must be a double
    */
    getExchangeRate: function() {
      return this.exchangeRate;
    },

    /**
    * Set the field value
    * Margin Rate Percentage
    *
    * @memberof payments.DCCInfo
    * @param {String} marginRatePercentage 
    */
    setMarginRatePercentage: function(marginRatePercentage) {
      this.marginRatePercentage = marginRatePercentage;
    },

    /**
    * Get the field value
    * Margin Rate Percentage
    * @memberof payments.DCCInfo
    * @return {String} 
    */
    getMarginRatePercentage: function() {
      return this.marginRatePercentage;
    },

    /**
    * Set the field value
    * Exchange Rate Source Name
    *
    * @memberof payments.DCCInfo
    * @param {String} exchangeRateSourceName 
    */
    setExchangeRateSourceName: function(exchangeRateSourceName) {
      this.exchangeRateSourceName = exchangeRateSourceName;
    },

    /**
    * Get the field value
    * Exchange Rate Source Name
    * @memberof payments.DCCInfo
    * @return {String} 
    */
    getExchangeRateSourceName: function() {
      return this.exchangeRateSourceName;
    },

    /**
    * Set the field value
    * Exchange Rate Source Timestamp
    *
    * @memberof payments.DCCInfo
    * @param {String} exchangeRateSourceTimeStamp 
    */
    setExchangeRateSourceTimeStamp: function(exchangeRateSourceTimeStamp) {
      this.exchangeRateSourceTimeStamp = exchangeRateSourceTimeStamp;
    },

    /**
    * Get the field value
    * Exchange Rate Source Timestamp
    * @memberof payments.DCCInfo
    * @return {String} 
    */
    getExchangeRateSourceTimeStamp: function() {
      return this.exchangeRateSourceTimeStamp;
    },

    /**
    * Set the field value
    * The payment with which this DCC info is associated
    *
    * @memberof payments.DCCInfo
    * @param {base.Reference} paymentRef 
    */
    setPaymentRef: function(paymentRef) {
      this.paymentRef = paymentRef;
    },

    /**
    * Get the field value
    * The payment with which this DCC info is associated
    * @memberof payments.DCCInfo
    * @return {base.Reference} 
    */
    getPaymentRef: function() {
      return this.paymentRef;
    },

    /**
    * @memberof payments.DCCInfo
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

DCCInfo._meta_ =  {fields:  {}};
DCCInfo._meta_.fields["inquiryRateId"] = {};
DCCInfo._meta_.fields["inquiryRateId"].type = Number;
DCCInfo._meta_.fields["dccApplied"] = {};
DCCInfo._meta_.fields["dccApplied"].type = Boolean;
DCCInfo._meta_.fields["foreignCurrencyCode"] = {};
DCCInfo._meta_.fields["foreignCurrencyCode"].type = String;
DCCInfo._meta_.fields["foreignAmount"] = {};
DCCInfo._meta_.fields["foreignAmount"].type = Number;
DCCInfo._meta_.fields["exchangeRate"] = {};
DCCInfo._meta_.fields["exchangeRate"].type = Number;
DCCInfo._meta_.fields["marginRatePercentage"] = {};
DCCInfo._meta_.fields["marginRatePercentage"].type = String;
DCCInfo._meta_.fields["exchangeRateSourceName"] = {};
DCCInfo._meta_.fields["exchangeRateSourceName"].type = String;
DCCInfo._meta_.fields["exchangeRateSourceTimeStamp"] = {};
DCCInfo._meta_.fields["exchangeRateSourceTimeStamp"].type = String;
DCCInfo._meta_.fields["paymentRef"] = {};
DCCInfo._meta_.fields["paymentRef"].type = base_Reference;

//
// Expose the module.
//
if ('undefined' !== typeof module) {
module.exports = DCCInfo;
}
