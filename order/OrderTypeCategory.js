/**
 * Autogenerated by Avro
 * 
 * DO NOT EDIT DIRECTLY
 */

// Prototype.js required
require("prototype");
var order_OrderType = require("../order/OrderType");
var inventory_Category = require("../inventory/Category");

  /**
  * @constructor
  * @memberof order
  */
  OrderTypeCategory = Class.create( {
    /**
    * Initialize the values for this.
    * @memberof order.OrderTypeCategory
    * @private
    */
    initialize: function() {
      this._class_ = OrderTypeCategory;
      this.orderType = undefined;
      this.category = undefined;
    },

    /**
    * Set the field value
    * @memberof order.OrderTypeCategory
    * @param {order.OrderType} orderType 
    */
    setOrderType: function(orderType) {
      this.orderType = orderType;
    },

    /**
    * Get the field value
    * @memberof order.OrderTypeCategory
    * @return {order.OrderType} 
    */
    getOrderType: function() {
      return this.orderType;
    },

    /**
    * Set the field value
    * @memberof order.OrderTypeCategory
    * @param {inventory.Category} category 
    */
    setCategory: function(category) {
      this.category = category;
    },

    /**
    * Get the field value
    * @memberof order.OrderTypeCategory
    * @return {inventory.Category} 
    */
    getCategory: function() {
      return this.category;
    },

    /**
    * @memberof order.OrderTypeCategory
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

OrderTypeCategory._meta_ =  {fields:  {}};
OrderTypeCategory._meta_.fields["orderType"] = {};
OrderTypeCategory._meta_.fields["orderType"].type = order_OrderType;
OrderTypeCategory._meta_.fields["category"] = {};
OrderTypeCategory._meta_.fields["category"].type = inventory_Category;

//
// Expose the module.
//
if ('undefined' !== typeof module) {
module.exports = OrderTypeCategory;
}
