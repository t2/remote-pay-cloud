var sdk = require("remote-pay-cloud-api");

var DelegateCloverConnectorListener = require("./DelegateCloverConnectorListener.js");
var DebugCloverConnectorListener = require("./DebugCloverConnectorListener.js");
var MethodToMessage = require("./MethodToMessage");
var CardEntryMethods = require("./CardEntryMethods.js");
var WebSocketDevice = require("./WebSocketDevice.js");
var RemoteMessageBuilder = require("./RemoteMessageBuilder.js");
var RemoteMessageParser = require("./RemoteMessageParser.js");
var XmlHttpSupport = require("./xmlHttpSupport.js");
var Endpoints = require("./Endpoints.js");
var CloverOAuth2 = require("./CloverOAuth2.js");
var DeviceContactInfo = require("./DeviceContactInfo.js");
var CloverError = require("./CloverError.js");
var ImageUtil = require("./ImageUtil.js");
var CloverID = require("./CloverID.js");
var EndPointConfig = require("./EndpointConfig.js");
var MessageBundle = require("./MessageBundle.js");
var CloudMethod = require("./CloudMethod.js");
var Logger = require('./Logger.js');
var LanMethod = require('./LanMethod.js');

// !!NOTE!!  The following is automatically updated to reflect the npm version.
// See the package.json postversion script, which maps to scripts/postversion.sh
// Do not change this or the versioning may not reflect the npm version correctly.
CLOVER_CLOUD_SDK_VERSION = "1.1.0-rc6.1";

/**
 *  Interface to the Clover remote-pay API.
 *
 *  Defines the interface used to interact with remote pay
 *  adapters.
 */

/**
 *
 * @param {Object.<string, string>} configuration - the configuration for the connector
 * @constructor
 */
var CloverConnectorImpl = function(configuration) {
    sdk.remotepay.ICloverConnector.call(this);
    this.log = Logger.create();

    this.cloverConnectorListeners = [];
    if(configuration){
        try {
            // Make sure we do not change the passed object, make a copy.
            this.configuration = JSON.parse(JSON.stringify(configuration));
        } catch(e) {
            this.log.error("Could not load configuration", e);
            throw e;
        }
    } else {
        this.configuration = {};
    }
    // This flag will be set by the discovery response.
    this.deviceSupportsAckMessages = false;

    this.debugConfiguration = {};
    if(this.configuration.debugConfiguration) {
        this.debugConfiguration = this.configuration.debugConfiguration
    } else {
        this.debugConfiguration = {};
    }

    this.device = new WebSocketDevice(this.configuration.allowOvertakeConnection,
      this.configuration[CloverConnectorImpl.KEY_FriendlyId] === null ?
        CloverID.getNewId() : this.configuration[CloverConnectorImpl.KEY_FriendlyId]
    );
    var builderPackageConf = this.configuration[CloverConnectorImpl.KEY_Package] ?
      this.configuration[CloverConnectorImpl.KEY_Package] : CloverConnectorImpl.WebSocketPackage;
    this.configuration[CloverConnectorImpl.KEY_Package] = builderPackageConf;

    if(!this.configuration["clientId"]) {
        throw new CloverError(CloverError.INCOMPLETE_CONFIGURATION, "'clientId' must be included in the configuration.");
    }
    if(!this.configuration["remoteApplicationId"]) {
        throw new CloverError(CloverError.INCOMPLETE_CONFIGURATION, "'remoteApplicationId' must be included in the configuration.");
    }
    var messageCount = isNaN(parseInt(this.configuration["messageCount"])) ?
      0 : parseInt(this.configuration["messageCount"]);

    this.remoteMessageParser = new RemoteMessageParser(builderPackageConf);
    this.messageBuilder = new RemoteMessageBuilder(builderPackageConf,
      CloverConnectorImpl.RemoteSourceSDK + ":" + CLOVER_CLOUD_SDK_VERSION,
      this.configuration["remoteApplicationId"], messageCount
    );
    this.device.messageBuilder = this.messageBuilder;

    this.device.echoAllMessages = false;
    this.pauseBetweenDiscovery = 3000;
    this.numberOfDiscoveryMessagesToSend = 10;
    this.discoveryResponseReceived = false;

    this.configuration.autoVerifySignature =
      Boolean(this.configuration.autoVerifySignature);
    this.configuration.disableRestartTransactionWhenFailed =
      Boolean(this.configuration.disableRestartTransactionWhenFailed);
    this.configuration.remotePrint =
      Boolean(this.configuration.remotePrint);
    this.configuration.allowOvertakeConnection =
      Boolean(this.configuration.allowOvertakeConnection);
    this.configuration.allowOfflinePayment  =
      Boolean(this.configuration.allowOfflinePayment);
    this.configuration.approveOfflinePaymentWithoutPrompt  =
      Boolean(this.configuration.approveOfflinePaymentWithoutPrompt);

    this.configuration.defaultEmployeeId =
      this.configuration["defaultEmployeeId"]===undefined ? "DFLTEMPLOYEE" :
        this.configuration.defaultEmployeeId;

    this.configuration.cardEntryMethods =
      this.configuration["cardEntryMethods"]===undefined ? CardEntryMethods.DEFAULT :
        this.configuration.cardEntryMethods;
    // This listener just sends messages on to the other listeners
    this.delegateCloverConnectorListener = new DelegateCloverConnectorListener(this);

    // Following is an internal structure used for specialized acknowledgement message handling.
    this.acknowledgementHooks = {};

    // We need to hold on to this because the finishOK does not provide enough information
    this.refundPaymentResponse = null; // RefundPaymentResponse;

    this.setupMappingOfProtocolMessages();

    //****************************************
    // Very useful for debugging
    //****************************************
    if (this.debugConfiguration[WebSocketDevice.ALL_MESSAGES]) {
        this.device.on(WebSocketDevice.ALL_MESSAGES,
          function (message) {
              // Do not log ping or pong
              if ((message['type'] != 'PONG') && (message['type'] != 'PING')) {
                  this.log.debug(message);
              }
          }.bind(this)
        );
    }
};

CloverConnectorImpl.prototype = Object.create(sdk.remotepay.ICloverConnector.prototype);
CloverConnectorImpl.prototype.constructor = CloverConnectorImpl;

/**
 * @param {Object} message - the message to send
 * @private
 */
CloverConnectorImpl.prototype.sendMessage = function(message) {
            try {
                this.log.debug("sendMessage", message);
                if(this.device == null) {
                    var notConnectedErrorEvent = new sdk.remotepay.CloverDeviceErrorEvent();
                    notConnectedErrorEvent.setMessage("Device is not connected");
                    notConnectedErrorEvent.setCode(sdk.remotepay.DeviceErrorEventCode.NotConnected);
                    notConnectedErrorEvent.setType(sdk.remotepay.ErrorType.COMMUNICATION);
                    this.delegateCloverConnectorListener.onDeviceError(notConnectedErrorEvent);
                } else {
                    this.device.sendMessage(message);
                }
            } catch(e) {
                var errorEvent = new sdk.remotepay.CloverDeviceErrorEvent();
                errorEvent.setType(sdk.remotepay.ErrorType.COMMUNICATION);
                errorEvent.setCode(sdk.remotepay.DeviceErrorEventCode.UnknownError);
                try {
                    if (e && e.message) {
                        errorEvent.setMessage("Could not send message : " + JSON.stringify(message) + "," + e.message);
                    } else {
                        errorEvent.setMessage("Could not send message : " + JSON.stringify(message) + "," + JSON.stringify(e));
                    }
                }catch(e) {
                    // no idea what to do now
                    this.log.error(e);
                }
                this.delegateCloverConnectorListener.onDeviceError(errorEvent);
            }
};

/**
 * Define how the low level protocol messages get translated into
 * the API calls.
 *
 *  @private
 */
CloverConnectorImpl.prototype.setupMappingOfProtocolMessages = function() {
    this.mapAck();
    this.mapDeviceEvents();
    this.mapConnectionEvents();
    this.mapDiscoveryResponse();
    this.mapVerifySignature();
    this.mapConfirmPayment();
    this.mapUIEvents();
    this.mapTipAdjustResponse();
    this.mapCapturePreauthResponse();
    this.mapCloseoutResponse();
    this.mapRefundResponse();
    this.mapPaymentVoided();
    this.mapVaultCardResponse();
    this.mapLastMessageResponse();
    this.mapFinishOk();
    this.mapFinishCancel();
    this.mapTxStartResponse();
    this.mapRetrievePendingPayments();
    this.mapCardDataResponse();
    this.mapShutdown();
    this.mapReset();
};

/**
 * This is a special method only used in Cloud.
 *
 * @private
 */
CloverConnectorImpl.prototype.mapShutdown = function() {
    this.device.on(LanMethod.SHUTDOWN,
      function (message) {
          this.dispose();
      }.bind(this));
};

/**
 * This is a special method only used in Cloud.
 *
 * @private
 */
CloverConnectorImpl.prototype.mapReset = function() {
    this.device.on(LanMethod.RESET,
      function (message) {
          this.onResetRequest();
      }.bind(this));
};

/**
 * When the server requests a connection reset, this will be called.
 *
 * The default implementation is to immediately drop the connection and reconnect.  To allow
 * for current work to be completed, this can be overridden.  If a reset request is sent, but ignored,
 * the server will forcably drop the connection after a period of time.
 */
CloverConnectorImpl.prototype.onResetRequest = function() {
    this.reconnect();
};

/**
 * @private
 */
CloverConnectorImpl.prototype.mapRetrievePendingPayments = function() {
    this.device.on(sdk.remotemessage.Method.RETRIEVE_PENDING_PAYMENTS_RESPONSE,
      function (message) {
          this.processRetrievePendingPayments(message);
      }.bind(this));
};

/**
 * This is a work in progress to generically extract a RemoteMessage from a json
 * in a generic way.  It seems to work for the cases where the mapping is correct
 * in MethodToMessage.
 *
 * @private
 *
 * @param remoteMessageJson
 * @return {sdk.remotemessage.RemoteMessage} the remote message object type that is mapped from the
 *  string returned from the remoteMessageJson.getMethod() call.
 */
CloverConnectorImpl.prototype.extractPayloadFromRemoteMessageJson = function(remoteMessageJson) {
    // Get the sdk.remotemessage.Message type for this message
    var responseMessageType = MethodToMessage[remoteMessageJson.getMethod()];
    // Create an instance of the message
    var remotemessageMessage = new responseMessageType;
    // Populate the message using the remoteMessageJson, which is a json object that is a
    // sdk.remotemessage.RemoteMessage
    this.remoteMessageParser.parseMessage(message, remotemessageMessage);
    // remotemessageMessage is a sdk.remotemessage.Message that is populated.
    return remotemessageMessage;
};

/**
 * currently unused
 * @private
 */
CloverConnectorImpl.prototype.mapTipAdded = function() {
    this.device.on(sdk.remotemessage.Method.TIP_ADDED, function (remoteMessageJson) {
        var protocolMessage = this.extractPayloadFromRemoteMessageJson(remoteMessageJson);
        //Do something with it
    }.bind(this));
};

/**
 * currently unused
 * @private
 */
CloverConnectorImpl.prototype.mapPartialAuth = function() {
    this.device.on(sdk.remotemessage.Method.PARTIAL_AUTH, function (remoteMessageJson) {
        var protocolMessage = this.extractPayloadFromRemoteMessageJson(remoteMessageJson);
        //Do something with it
    }.bind(this));
};

/**
 * @private
 */
CloverConnectorImpl.prototype.mapAck = function () {
    // Setup special acknowledgement message handling
    this.device.on(CloverConnectorImpl.ACK,
      function (message) {
          // var remoteMessage = new sdk.remotemessage.RemoteMessage();
          // Note that the following does not work for The cloud specific messages:
          // SHUTDOWN, ERROR; because they are not members of the Method enumeration.
          // this.remoteMessageParser.transfertoObject(message, remoteMessage);
          // See if there is a registered callback for the message
          var ackMessage = new sdk.remotemessage.AcknowledgementMessage();
          this.remoteMessageParser.parseMessage(message, ackMessage);
          if(!ackMessage.getSourceMessageId()) {
              // backwards compatibility hack.
              ackMessage.setSourceMessageId(message.id);
          }
          var callback = this.acknowledgementHooks[ackMessage.getSourceMessageId()];
          if (callback) {
              try {
                  // These are one time hooks.  Remove the callback
                  delete this.acknowledgementHooks[ackMessage.getSourceMessageId()];
                  // Call the registered callback
                  callback();
              } catch (e) {
                  this.log.warn(e);
              }
          }
      }.bind(this));
};

/**
 * @private
 */
CloverConnectorImpl.prototype.mapDeviceEvents = function() {
    this.device.on(WebSocketDevice.DEVICE_OPEN, function (event) {
        // The connection to the device is open, but we do not yet know if there is anyone at the other end.
        // Send discovery request message.
        this.log.debug(event);
        this.sendMessage(this.messageBuilder.buildDiscoveryRequestObject());
        this.delegateCloverConnectorListener.onConnected();
    }.bind(this));
    this.device.on(WebSocketDevice.DEVICE_CLOSE, function (event) {
        this.log.debug(event);
        this.delegateCloverConnectorListener.onDisconnected();
    }.bind(this));
    this.device.on(WebSocketDevice.DEVICE_ERROR, function (event) {
        // todo: Will figure out error codes later
        this.log.debug(event);
        var deviceErrorEvent = new sdk.remotepay.CloverDeviceErrorEvent();
        deviceErrorEvent.setType(sdk.remotepay.ErrorType.COMMUNICATION);
        //deviceErrorEvent.setCode(DeviceErrorEventCode.AccessDenied);
        this.delegateCloverConnectorListener.onDeviceError(deviceErrorEvent);
    }.bind(this));
};

/**
 * @private
 */
CloverConnectorImpl.prototype.mapConnectionEvents = function() {
    this.device.on(CloverConnectorImpl.ERROR, function (event) {
        // Will figure out error codes later
        this.log.debug(event);
        var deviceErrorEvent = new sdk.remotepay.CloverDeviceErrorEvent();
        deviceErrorEvent.setType(sdk.remotepay.ErrorType.EXCEPTION);
        //deviceErrorEvent.setCode(DeviceErrorEventCode.AccessDenied);
        this.delegateCloverConnectorListener.onDeviceError(deviceErrorEvent);
    }.bind(this));
    this.device.on(WebSocketDevice.CONNECTION_ERROR, function (message) {
        // Will figure out error codes later
        this.log.debug(message);
        var deviceErrorEvent = new sdk.remotepay.CloverDeviceErrorEvent();
        deviceErrorEvent.setType(sdk.remotepay.ErrorType.COMMUNICATION);
        //deviceErrorEvent.setCode(DeviceErrorEventCode.AccessDenied);
        deviceErrorEvent.setMessage(message);
        this.delegateCloverConnectorListener.onDeviceError(deviceErrorEvent);
    }.bind(this));
    this.device.on(WebSocketDevice.CONNECTION_STOLEN, function (message) {
        this.log.debug(message);
        // How do we handle this?  Message is the friendly id of the
        // other terminal that stole the connection.
        this.delegateCloverConnectorListener.onDisconnected();
    }.bind(this));
    this.device.on(WebSocketDevice.CONNECTION_DENIED, function (message) {
        this.log.debug(message);
        // Will figure out error codes later
        var deviceErrorEvent = new sdk.remotepay.CloverDeviceErrorEvent();
        deviceErrorEvent.setMessage(message);
        deviceErrorEvent.setCode(sdk.remotepay.DeviceErrorEventCode.AccessDenied);
        deviceErrorEvent.setType(sdk.remotepay.ErrorType.COMMUNICATION);
        this.delegateCloverConnectorListener.onDeviceError(deviceErrorEvent);
    }.bind(this));
};

/**
 * @private
 */
CloverConnectorImpl.prototype.mapDiscoveryResponse = function() {
    this.device.on(sdk.remotemessage.Method.DISCOVERY_RESPONSE, function (message) {
        var discoveryResponse = new sdk.remotemessage.DiscoveryResponseMessage();
        this.remoteMessageParser.parseMessage(message, discoveryResponse);

        /**  This goes in a deserialization class **/
        var merchantInfo = new sdk.remotepay.MerchantInfo();
        merchantInfo.setMerchantID(discoveryResponse.getMerchantId());
        merchantInfo.setMerchantName(discoveryResponse.getMerchantName());
        merchantInfo.setMerchantMID(discoveryResponse.getMerchantMId());
        merchantInfo.setSupportsTipAdjust(discoveryResponse.getSupportsTipAdjust());
        merchantInfo.setSupportsManualRefunds(discoveryResponse.getSupportsManualRefund());

        var deviceInfo = new sdk.remotepay.DeviceInfo();
        deviceInfo.setName( discoveryResponse.getName() );
        deviceInfo.setSerial(discoveryResponse.getSerial());
        deviceInfo.setModel(discoveryResponse.getModel());

        merchantInfo.setDeviceInfo(deviceInfo);

        this.deviceSupportsAckMessages = discoveryResponse.supportsAcknowledgement;

        this.delegateCloverConnectorListener.onReady(merchantInfo);
    }.bind(this));
};

/**
 * @private
 */
CloverConnectorImpl.prototype.mapVerifySignature = function() {
    this.device.on(sdk.remotemessage.Method.VERIFY_SIGNATURE, function (message) {
        this.processVerifySignature(message);
    }.bind(this));
};

/**
 * @private
 */
CloverConnectorImpl.prototype.mapConfirmPayment = function() {
    this.device.on(sdk.remotemessage.Method.CONFIRM_PAYMENT_MESSAGE, function (message) {
        this.processConfirmPayment(message);
    }.bind(this));
};

/**
 * @private
 */
CloverConnectorImpl.prototype.mapUIEvents = function() {
    this.device.on(sdk.remotemessage.Method.UI_STATE, function (message) {
        var uiMessage = new sdk.remotemessage.UiStateMessage();
        this.remoteMessageParser.parseMessage(message, uiMessage);

        var deviceEvent = new sdk.remotepay.CloverDeviceEvent();
        deviceEvent.setMessage(uiMessage.getUiText());
        // Following maps exactly, but want insulation from
        // remotemessage <-> remotepay
        //noinspection JSCheckFunctionSignatures
        deviceEvent.setEventState(uiMessage.getUiState());
        deviceEvent.setInputOptions(uiMessage.getInputOptions());

        if(uiMessage.getUiDirection() === sdk.remotemessage.UiDirection.ENTER) {
            this.delegateCloverConnectorListener.onDeviceActivityStart(deviceEvent);
        } else {
            this.delegateCloverConnectorListener.onDeviceActivityEnd(deviceEvent);
        }
    }.bind(this));
};

/**
 * @private
 */
CloverConnectorImpl.prototype.mapTipAdjustResponse = function() {
    this.device.on(sdk.remotemessage.Method.TIP_ADJUST_RESPONSE, function (remoteMessage) {
        var message = new sdk.remotemessage.TipAdjustResponseMessage();
        this.remoteMessageParser.parseMessage(remoteMessage, message);

        var apiMessage = new sdk.remotepay.TipAdjustAuthResponse();
        apiMessage.setSuccess(message.getSuccess());
        apiMessage.setTipAmount(message.getAmount());
        apiMessage.setPaymentId(message.getPaymentId());

        this.delegateCloverConnectorListener.onTipAdjustAuthResponse(apiMessage);
    }.bind(this));
};

/**
 * Newer sdk.remotemessage response objects contain a more standard pattern, but they do not share a
 * baseclass.  This results in the unfortunate need for a convention that is not enforced.  Some
 * subclasses will have these functions, others may not.
 *
 * The convention is the presence of the getStatus() and getReason() functions.
 *
 * @param {remotepay.BaseResponse} apiMessage
 * @param {remotemessage.Message} message
 */
CloverConnectorImpl.prototype.populateGeneric = function(apiMessage, message) {
    try {
        //noinspection JSUnresolvedFunction
        apiMessage.setSuccess(message.getStatus() == sdk.remotepay.ResultStatus.SUCCESS);
    }catch(e){
        this.log.error("Attempt to set success failed!");
    }
    try {
        //noinspection JSUnresolvedFunction
        apiMessage.setResult(message.getStatus() == sdk.remotepay.ResultStatus.SUCCESS ?
          sdk.remotepay.ResponseCode.SUCCESS : message.getCode() == sdk.remotepay.ResultStatus.FAIL ?
          sdk.remotepay.ResponseCode.FAIL : sdk.remotepay.ResponseCode.ERROR );
    }catch(e){
        this.log.error("Attempt to set result failed!");
    }
    try {
        //noinspection JSUnresolvedFunction
        apiMessage.setReason(message.getReason());
    }catch(e){
        this.log.warn("Attempt to set reason failed!");
    }

};

/**
 * @private
 */
CloverConnectorImpl.prototype.mapCapturePreauthResponse = function() {
    this.device.on(sdk.remotemessage.Method.CAPTURE_PREAUTH_RESPONSE, function (remoteMessage) {
        var message = new sdk.remotemessage.CapturePreAuthResponseMessage();
        this.remoteMessageParser.parseMessage(remoteMessage, message);

        var apiMessage = new sdk.remotepay.CapturePreAuthResponse();
        this.populateGeneric(apiMessage, message);

        apiMessage.setPaymentId(message.getPaymentId());
        apiMessage.setAmount(message.getAmount());
        apiMessage.setTipAmount(message.getTipAmount());

        this.delegateCloverConnectorListener.onCapturePreAuthResponse(apiMessage);
    }.bind(this));
};

/**
 * @private
 */
CloverConnectorImpl.prototype.mapCloseoutResponse = function() {
    this.device.on(sdk.remotemessage.Method.CLOSEOUT_RESPONSE, function (remoteMessage) {
        var message = new sdk.remotemessage.CloseoutResponseMessage();
        this.remoteMessageParser.parseMessage(remoteMessage, message);

        var apiMessage = new sdk.remotepay.CloseoutResponse();
        this.populateGeneric(apiMessage, message);

        apiMessage.setBatch(message.getBatch());
        this.delegateCloverConnectorListener.onCloseoutResponse(apiMessage);
    }.bind(this));
};

/**
 * This message has additional information about failures, so we build
 * a response based on this information - if the result is a failure.
 * This will then be used in the "finishCancel" processing.
 *
 *
 * @private
 */
CloverConnectorImpl.prototype.mapRefundResponse = function() {
    this.device.on(sdk.remotemessage.Method.REFUND_RESPONSE, function (remoteMessage) {
        var message = new sdk.remotemessage.RefundResponseMessage();
        this.remoteMessageParser.parseMessage(remoteMessage, message);

        if(message.getCode() != sdk.remotemessage.TxState.SUCCESS) {
            this.refundPaymentResponse = new sdk.remotepay.RefundPaymentResponse();
            this.refundPaymentResponse.setSuccess(message.getCode() == sdk.remotemessage.TxState.SUCCESS);
            this.refundPaymentResponse.setResult(message.getCode() == sdk.remotemessage.TxState.SUCCESS ?
              sdk.remotepay.ResponseCode.SUCCESS : message.getCode() == sdk.remotemessage.TxState.FAIL ?
              sdk.remotepay.ResponseCode.FAIL : sdk.remotepay.ResponseCode.ERROR);
            this.refundPaymentResponse.setReason(message.getReason());
            this.refundPaymentResponse.setMessage(message.getMessage());

            this.refundPaymentResponse.setRefund(message.getRefund());
        }
        // This is now called from finishOK mapping
        // this.delegateCloverConnectorListener.onRefundPaymentResponse(apiMessage);
    }.bind(this));
};

/**
 * @private
 */
CloverConnectorImpl.prototype.mapPaymentVoided = function() {
    this.device.on(sdk.remotemessage.Method.PAYMENT_VOIDED, function (remoteMessage) {
        this.log.debug(remoteMessage);
        var message = new sdk.remotemessage.PaymentVoidedMessage();
        this.remoteMessageParser.parseMessage(remoteMessage, message);

        this.sendVoidPaymentResponse(message.getPayment());
    }.bind(this));
};

/**
 * @private
 */
CloverConnectorImpl.prototype.mapVaultCardResponse = function() {
    this.device.on(sdk.remotemessage.Method.VAULT_CARD_RESPONSE, function (remoteMessage) {
        var message = new sdk.remotemessage.VaultCardResponseMessage();
        this.remoteMessageParser.parseMessage(remoteMessage, message);

        var apiMessage = new sdk.remotepay.VaultCardResponse();
        this.populateGeneric(apiMessage, message);

        apiMessage.setCard(message.getCard());

        var endOfOperationCallback = function() {
            this.delegateCloverConnectorListener.onVaultCardResponse(apiMessage);
        }.bind(this);

        if(apiMessage.getSuccess()) {
            this.endOfOperationOK(endOfOperationCallback);
        } else {
            this.endOfOperationCancel(endOfOperationCallback);
        }
    }.bind(this));
};

/**
 * @private
 */
CloverConnectorImpl.prototype.mapCardDataResponse = function() {
    this.device.on(sdk.remotemessage.Method.CARD_DATA_RESPONSE, function (remoteMessage) {
        var message = new sdk.remotemessage.CardDataResponseMessage();
        this.remoteMessageParser.parseMessage(remoteMessage, message);

        var apiMessage = new sdk.remotepay.ReadCardDataResponse();
        this.populateGeneric(apiMessage, message);

        apiMessage.setCardData(message.getCardData());

        var endOfOperationCallback = function() {
            this.delegateCloverConnectorListener.onReadCardDataResponse(apiMessage);
        }.bind(this);

        if(apiMessage.getSuccess()) {
            this.endOfOperationOK(endOfOperationCallback);
        } else {
            this.endOfOperationCancel(endOfOperationCallback);
        }
    }.bind(this));
};


/**
 * @private
 */
CloverConnectorImpl.prototype.mapLastMessageResponse = function() {
    this.device.on(sdk.remotemessage.Method.LAST_MSG_RESPONSE, function (remoteMessage) {
        var message = new sdk.remotemessage.LastMessageResponseMessage();
        // Pass the flag to attach unknown properties to the object.
        this.remoteMessageParser.parseMessage(remoteMessage, message);

        var requestMessageType = MethodToMessage[message.getRequest().getMethod()];
        var requestMessageInstance = new requestMessageType;
        this.remoteMessageParser.transfertoObject(message.getRequest(), requestMessageInstance);
        message.setRequest(requestMessageInstance);

        var responseMessageType = MethodToMessage[message.getResponse().getMethod()];
        var responseMessageInstance = new responseMessageType;
        this.remoteMessageParser.transfertoObject(message.getResponse(), responseMessageInstance);
        message.setResponse(responseMessageInstance);

        var apiMessage = new sdk.remotepay.BaseResponse();
        apiMessage.setCode(sdk.remotepay.ResponseCode.SUCCESS);
        apiMessage["request"] = requestMessageInstance;
        apiMessage["request"] = responseMessageInstance;

        this.delegateCloverConnectorListener.onLastTransactionResponse(apiMessage);
    }.bind(this));
};

/**
 * @private
 */
CloverConnectorImpl.prototype.mapTxStartResponse = function () {
    this.device.on(sdk.remotemessage.Method.TX_START_RESPONSE, function (message) {
        this.log.debug(message);
        var txStartResponseMessage = new sdk.remotemessage.TxStartResponseMessage();
        this.remoteMessageParser.parseMessage(message, txStartResponseMessage);

        if (!txStartResponseMessage.getSuccess()) {
            var theLastRequest = this.lastRequest;
            this.lastRequest = null;
            var endOfOperationCallback = null;

            if (this.matchsLastRequest(theLastRequest, sdk.remotepay.PreAuthRequest)) {
                var preAuthResponse = new sdk.remotepay.PreAuthResponse();
                this.populateTxStartResponseToBaseResponse(txStartResponseMessage, preAuthResponse);
                endOfOperationCallback = function () {
                    this.delegateCloverConnectorListener.onPreAuthResponse(preAuthResponse);
                }.bind(this);
            } else if (this.matchsLastRequest(theLastRequest, sdk.remotepay.AuthRequest)) {
                var authResponse = new sdk.remotepay.AuthResponse();
                this.populateTxStartResponseToBaseResponse(txStartResponseMessage, authResponse);
                endOfOperationCallback = function () {
                    this.delegateCloverConnectorListener.onAuthResponse(authResponse);
                }.bind(this);
            } else if (this.matchsLastRequest(theLastRequest, sdk.remotepay.SaleRequest)) {
                var saleResponse = new sdk.remotepay.SaleResponse();
                this.populateTxStartResponseToBaseResponse(txStartResponseMessage, saleResponse);
                endOfOperationCallback = function () {
                    this.delegateCloverConnectorListener.onSaleResponse(saleResponse);
                }.bind(this);
            } else if (this.matchsLastRequest(theLastRequest, sdk.remotepay.ManualRefundRequest)) {
                var manualRefundResponse = new sdk.remotepay.ManualRefundResponse();
                this.populateTxStartResponseToBaseResponse(txStartResponseMessage, manualRefundResponse);
                endOfOperationCallback = function () {
                    this.delegateCloverConnectorListener.onManualRefundResponse(manualRefundResponse);
                }.bind(this);
            } else if (this.matchsLastRequest(theLastRequest, sdk.remotepay.RefundRequestMessage)) {
                var apiMessage = new sdk.remotepay.RefundPaymentResponse();
                this.populateTxStartResponseToBaseResponse(txStartResponseMessage, apiMessage);
                this.refundPaymentResponse = null;
                endOfOperationCallback = function () {
                    this.delegateCloverConnectorListener.onRefundPaymentResponse(apiMessage);
                }.bind(this);
            }
            this.endOfOperationCancel(endOfOperationCallback);
        }
    }.bind(this));
};

CloverConnectorImpl.prototype.matchsLastRequest = function (lastRequest, theType) {
    var result = false;
    if(lastRequest != null) {
        var lastReqStr = '' + lastRequest._class_;
        var theTypeStr = '' + theType;
        result = (lastReqStr == theTypeStr);
    }
    return result;
};

/**
 * @private
 * @param {remotemessage.TxStartResponseMessage} txStartResponseMessage
 * @param {remotepay.BaseResponse} response
 */
CloverConnectorImpl.prototype.populateTxStartResponseToBaseResponse = function(txStartResponseMessage, response) {
    response.setSuccess(txStartResponseMessage.getSuccess());
    var result = sdk.remotepay.ResponseCode[txStartResponseMessage.getResult()];
    if(!result)result = sdk.remotepay.ResponseCode.FAIL;
    response.setResult(result);
    response.setReason(txStartResponseMessage.getExternalPaymentId());
};

/**
 * @private
 */
CloverConnectorImpl.prototype.mapFinishOk = function () {
    this.device.on(sdk.remotemessage.Method.FINISH_OK, function (message) {
        this.log.debug(message);

        var finishOk = new sdk.remotemessage.FinishOkMessage();
        this.remoteMessageParser.parseMessage(message, finishOk);
        var theLastRequest = this.lastRequest;
        this.lastRequest = null;

        var endOfOperationCallback = null;

        if (finishOk.getPayment() !== undefined) {
            if (this.matchsLastRequest(theLastRequest, sdk.remotepay.PreAuthRequest)) {
                var preAuthResponse = new sdk.remotepay.PreAuthResponse();
                this.populateOkPaymentResponse(preAuthResponse, finishOk.getPayment(), finishOk.getSignature());
                endOfOperationCallback = function () {
                    this.delegateCloverConnectorListener.onPreAuthResponse(preAuthResponse);
                }.bind(this);
            } else if (this.matchsLastRequest(theLastRequest, sdk.remotepay.AuthRequest)) {
                var authResponse = new sdk.remotepay.AuthResponse();
                this.populateOkPaymentResponse(authResponse, finishOk.getPayment(), finishOk.getSignature());
                endOfOperationCallback = function () {
                    this.delegateCloverConnectorListener.onAuthResponse(authResponse);
                }.bind(this);
            } else if (this.matchsLastRequest(theLastRequest, sdk.remotepay.SaleRequest)) {
                var saleResponse = new sdk.remotepay.SaleResponse();
                this.populateOkPaymentResponse(saleResponse, finishOk.getPayment(), finishOk.getSignature());
                endOfOperationCallback = function () {
                    this.delegateCloverConnectorListener.onSaleResponse(saleResponse);
                }.bind(this);
            } else if (theLastRequest === null) {
                this.showWelcomeScreen();
                return; // skip the end of operation
            } else {
                this.resetDevice();
                throw new CloverError(CloverError.INVALID_DATA,
                  "Failed to pair this response. " + finishOk.getPayment());
            }
        } else if (finishOk.getCredit()) {
            var manualRefundResponse = new sdk.remotepay.ManualRefundResponse();
            manualRefundResponse.setSuccess(true);
            manualRefundResponse.setCredit(finishOk.getCredit());
            endOfOperationCallback = function () {
                this.delegateCloverConnectorListener.onManualRefundResponse(manualRefundResponse);
            }.bind(this);
        } else if (finishOk.getRefund()) {
            var apiMessage = new sdk.remotepay.RefundPaymentResponse();
            apiMessage.setSuccess(true);
            apiMessage.setRefund(finishOk.getRefund());
            this.refundPaymentResponse = null;
            endOfOperationCallback = function () {
                this.delegateCloverConnectorListener.onRefundPaymentResponse(apiMessage);
            }.bind(this);
        } else {
            // Something is wrong...
            this.log.error(sdk.remotemessage.Method.FINISH_OK +
              " received, but no payment, credit or refund attached to it!");
        }
        this.endOfOperationOK(endOfOperationCallback);
    }.bind(this));
};

/**
 * @private
 */
CloverConnectorImpl.prototype.mapFinishCancel = function () {
    this.device.on(sdk.remotemessage.Method.FINISH_CANCEL, function (message) {
        this.log.debug(message);

        var finishCancel = new sdk.remotemessage.FinishCancelMessage();
        this.remoteMessageParser.parseMessage(message, finishCancel);
        var endOfOperationCallback = null;
        var theLastRequest = this.lastRequest;
        this.lastRequest = null;

        if (this.matchsLastRequest(theLastRequest, sdk.remotepay.PreAuthRequest)) {
            var preAuthResponse = new sdk.remotepay.PreAuthResponse();
            this.populateCancelResponse(preAuthResponse);
            endOfOperationCallback = function () {
                this.delegateCloverConnectorListener.onPreAuthResponse(preAuthResponse);
            }.bind(this);
        } else if (this.matchsLastRequest(theLastRequest, sdk.remotepay.AuthRequest)) {
            var authResponse = new sdk.remotepay.AuthResponse();
            this.populateCancelResponse(authResponse);
            endOfOperationCallback = function () {
                this.delegateCloverConnectorListener.onAuthResponse(authResponse);
            }.bind(this);
        } else if (this.matchsLastRequest(theLastRequest, sdk.remotepay.SaleRequest)) {
            var saleResponse = new sdk.remotepay.SaleResponse();
            this.populateCancelResponse(saleResponse);
            endOfOperationCallback = function () {
                this.delegateCloverConnectorListener.onSaleResponse(saleResponse);
            }.bind(this);
        } else if (this.matchsLastRequest(theLastRequest, sdk.remotepay.ManualRefundRequest)) {
            var manualRefundResponse = new sdk.remotepay.ManualRefundResponse();
            this.populateCancelResponse(manualRefundResponse);
            endOfOperationCallback = function () {
                this.delegateCloverConnectorListener.onManualRefundResponse(manualRefundResponse);
            }.bind(this);
        } else if (this.matchsLastRequest(theLastRequest, sdk.remotepay.RefundPaymentRequest)) {
            /*
            This case is a little different.  The REFUND_RESPONSE message has greater details on failures,
            so we will try to return information from that (if it is set)
             */
            var apiMessage = this.refundPaymentResponse;
            this.refundPaymentResponse = null;
            if(!apiMessage) {
                // The REFUND_RESPONSE did not set the variable, make a new one and populate it.
                apiMessage = new sdk.remotepay.RefundPaymentResponse();
                this.populateCancelResponse(apiMessage);
            }
            endOfOperationCallback = function () {
                this.delegateCloverConnectorListener.onRefundPaymentResponse(apiMessage);
            }.bind(this);
        }
        this.endOfOperationCancel(endOfOperationCallback);
    }.bind(this));
};

/**
 * @private
 * @param message
 */
CloverConnectorImpl.prototype.processVerifySignature = function(message) {
    var verifySignature = new sdk.remotemessage.VerifySignatureMessage();
    this.remoteMessageParser.parseMessage(message, verifySignature);

    var verifySignatureRequest = new sdk.remotepay.VerifySignatureRequest();
    verifySignatureRequest.setPayment(verifySignature.getPayment());
    verifySignatureRequest.setSignature(verifySignature.getSignature());

    this.delegateCloverConnectorListener.onVerifySignatureRequest(verifySignatureRequest);
};

/**
 * @private
 * @param remoteMessage
 */
CloverConnectorImpl.prototype.processRetrievePendingPayments = function(remoteMessage) {
    var message = new sdk.remotemessage.RetrievePendingPaymentsResponseMessage();
    this.remoteMessageParser.parseMessage(remoteMessage, message);

    var apiMessage = new sdk.remotepay.RetrievePendingPaymentsResponse();
    this.populateGeneric(apiMessage, message);

    apiMessage.setPendingPaymentEntries(message.getPendingPaymentEntries());

    this.delegateCloverConnectorListener.onRetrievePendingPaymentsResponse(apiMessage);
};

/**
 * @private
 * @param message
 */
CloverConnectorImpl.prototype.processConfirmPayment = function(message) {
    var confirmPayment = new sdk.remotemessage.ConfirmPaymentMessage();
    this.remoteMessageParser.parseMessage(message, confirmPayment);

    var confirmPaymentRequest = new sdk.remotepay.ConfirmPaymentRequest();
    confirmPaymentRequest.setPayment(confirmPayment.getPayment());
    confirmPaymentRequest.setChallenges(confirmPayment.getChallenges());

    this.delegateCloverConnectorListener.onConfirmPaymentRequest(confirmPaymentRequest);
};

/**
 * Other implementations send this without receiving a message.
 * Not sure if this one should do the same.
 *
 * @private
 * @param {payments.Payment} payment
 */
CloverConnectorImpl.prototype.sendVoidPaymentResponse = function(payment) {
    var apiMessage = new sdk.remotepay.VoidPaymentResponse();
    apiMessage.setSuccess(true);
    apiMessage.setResult(sdk.remotepay.ResponseCode.SUCCESS);
    apiMessage.setPaymentId(payment.getId());

    this.delegateCloverConnectorListener.onVoidPaymentResponse(apiMessage);
};

/**
 * action after an operation cancel
 * @private
 */
CloverConnectorImpl.prototype.endOfOperationCancel = function(callback) {
    // Build the transaction cancelled message to display
    var protocolRequest = new sdk.remotemessage.TerminalMessage();
    protocolRequest.setText(MessageBundle.TRANSACTION_CANCELLED);
    // Send the message.  Once the ACK is received for this, we will wait three
    // seconds, then call the end of operation function, passing along
    // the callback passed to this.
    this.callOnACK(protocolRequest, function () {
        if (this.device != null) {
            setTimeout(
              function () {
                  this.endOfOperationOK(callback);
              }.bind(this), 3000 // three seconds
            );
        }
    }.bind(this));
};

/**
 * action after an operation ok
 * @private
 */
CloverConnectorImpl.prototype.endOfOperationOK = function(callback) {
    // Build the thank you message
    var protocolRequest = new sdk.remotemessage.ThankYouMessage();
    // Send the thank you message, wait for the "ACK" from it to present the
    // Welcome Screen after three seconds.
    this.callOnACK(protocolRequest, function () {
        if (this.device != null) {
            setTimeout(
              function () {
                  if (this.device != null) {
                      // Build the "Welcome" message
                      var protocolRequest2 = new sdk.remotemessage.WelcomeMessage();
                      // Send the welcome message, wait for the "ACK" from it to call
                      // whatever callback was passed.
                      this.callOnACK(protocolRequest2, callback);
                  }
              }.bind(this), 3000 // three seconds
            );
        }
    }.bind(this));
};

CloverConnectorImpl.prototype.callOnACK = function(protocolRequest, callback) {
    if(this.device != null) {
        // Wait for an ACK... then call sendVoidPaymentResponse
        var remoteMessage = this.messageBuilder.buildRemoteMessageObject(protocolRequest);
        // This is a backwards compatibility hack.
        if(this.deviceSupportsAckMessages) {
            // If acknowledgements are supported, then
            // wait for an ACK from the device.  The ACK hook will call
            // callback()

            // Add the hook
            // send the message
            this.addAcknowledgementHook(remoteMessage.getId(), callback);
            this.sendMessage(remoteMessage);
        } else {
            // ACK messages are  not supported.  We will just send the message before
            // calling the callback.  This causes threading issues, but is necessary for
            // backwards compatibility.
            this.sendMessage(remoteMessage);
            if(callback) {
                callback();
            }
        }
    }
};

/**
 * @private
 * @param {remotepay.PaymentResponse} response
 * @param {payments.Payment} payment
 * @param {base.Signature} signature
 */
CloverConnectorImpl.prototype.populateOkPaymentResponse = function(response, payment, signature) {
    response.setPayment(payment);
    response.setSignature(signature);
    response.setSuccess(true);
    response.setIsPreAuth(
      (payment.getResult() === sdk.payments.Result.AUTH) &&
      (payment.getCardTransaction().getType() ===  sdk.payments.CardTransactionType.PREAUTH));
    response.setIsSale(
      (payment.getResult() === sdk.payments.Result.SUCCESS) &&
      (payment.getCardTransaction().getType() ===  sdk.payments.CardTransactionType.AUTH));
    response.setIsAuth(
      (payment.getResult() === sdk.payments.Result.SUCCESS) &&
      (payment.getCardTransaction().getType() ===  sdk.payments.CardTransactionType.PREAUTH));
};

/**
 * @private
 * @param {remotepay.BaseResponse} response
 */
CloverConnectorImpl.prototype.populateCancelResponse = function(response) {
    response.setSuccess(false);
    response.setResult(sdk.remotepay.ResponseCode.CANCEL);
};

/**
 * Begin connecting.
 */
CloverConnectorImpl.prototype.initializeConnection = function() {
    if (this.configuration.oauthToken) {
        if(!this.configuration.merchantId) {
            if(!this.cloverOAuth) {
                // We must have the merchant id.  This will make the merchant log in again.
                this.configuration.oauthToken = this.getAuthToken(); // calls initializeConnection
                return;
            } else {
                this.configuration.merchantId = this.cloverOAuth.getURLParams()["merchant_id"];
            }
        }
        if(!this.configuration.merchantId) {
            // could not connect, not enough info
            var errorResponse1 = new sdk.remotepay.CloverDeviceErrorEvent();
            errorResponse1.setCode(sdk.remotepay.DeviceErrorEventCode.InvalidConfig);
            errorResponse1.setType(sdk.remotepay.ErrorType.VALIDATION);
            errorResponse1.setMessage("Cannot determine merchant to use.  " +
              "Configuration is missing merchant id (merchantId)");
            this.delegateCloverConnectorListener.onDeviceError(errorResponse1);
        } else if (this.configuration.domain) {
            var endpointConfig = new EndPointConfig(this.configuration);
            var endpoints = new Endpoints(endpointConfig);
            if (this.configuration.deviceId) {
                // Contact the server and tell it to send an alert to the device
                this.sendNotificationToDevice(endpoints);
            } else {
                this.getDeviceId(endpoints);
            }
        } else {
            // Note: Could default to www.clover.com here
            var errorResponse2 = new sdk.remotepay.CloverDeviceErrorEvent();
            errorResponse2.setCode(sdk.remotepay.DeviceErrorEventCode.InvalidConfig);
            errorResponse2.setType(sdk.remotepay.ErrorType.VALIDATION);
            errorResponse2.setMessage("Cannot determine domain to use.  " +
              "Configuration is missing domain (domain)");
            this.delegateCloverConnectorListener.onDeviceError(errorResponse2);
        }
    } else if (this.configuration.clientId && this.configuration.domain) {
        this.configuration.oauthToken = this.getAuthToken(); // calls initializeConnection
    } else {
        var errorResponse = new sdk.remotepay.CloverDeviceErrorEvent();
        errorResponse.setCode(sdk.remotepay.DeviceErrorEventCode.InvalidConfig);
        errorResponse2.setType(sdk.remotepay.ErrorType.VALIDATION);
        errorResponse.setMessage("Cannot determine client id or domain to use.  " +
          "Configuration is missing domain (domain), or client id (clientId)");
        this.delegateCloverConnectorListener.onDeviceError(errorResponse);
    }
};

/**
 * @private
 * @param endpoints
 */
CloverConnectorImpl.prototype.getDeviceId = function(endpoints) {
    if(this.configuration.deviceSerialId) {
        var url = endpoints.getDevicesEndpoint(this.configuration.merchantId);
        if(!this["devices"] || !this["devices"][url]) {
            var xmlHttpSupport = new XmlHttpSupport();
            xmlHttpSupport.getData(url,
              function (devices) {
                  if(!this["devices"]) {
                      this.devices = {};
                  }
                  this.devices[url] = this.buildMapOfSerialToDevice(devices);
                  this.handleDeviceResult(this.devices[url]);
              }.bind(this),
              function (error) {
                  var errorResponse1 = new sdk.remotepay.CloverDeviceErrorEvent();
                  errorResponse1.setType(sdk.remotepay.ErrorType.COMMUNICATION);
                  errorResponse1.setCode(sdk.remotepay.DeviceErrorEventCode.UnknownError);
                  errorResponse1.setMessage(error);
                  this.delegateCloverConnectorListener.onDeviceError(errorResponse1)
              }.bind(this)
            );
        } else {
            this.handleDeviceResult(this.devices[url]);
        }
    } else {
        // could not connect, not enough info
        var errorResponse = new sdk.remotepay.CloverDeviceErrorEvent();
        errorResponse.setCode(sdk.remotepay.DeviceErrorEventCode.InvalidConfig);
        errorResponse.setType(sdk.remotepay.ErrorType.VALIDATION);
        errorResponse.setMessage("Cannot determine device to use.  " +
          "Configuration is missing device serial id (deviceSerialId)");
        this.delegateCloverConnectorListener.onDeviceError(errorResponse);
    }
};

/**
 * This function is called with the list of devices for the merchant.  The default implementation
 * is to set the deviceId to theat of the device that maps to the this.configuration.deviceSerialId
 * @param devices
 */
CloverConnectorImpl.prototype.handleDeviceResult = function(devices) {
    var myDevice = devices[this.configuration.deviceSerialId];
    if (null == myDevice) {
        var errorResponse = new sdk.remotepay.CloverDeviceErrorEvent();
        errorResponse.setType(sdk.remotepay.ErrorType.VALIDATION);
        errorResponse.setCode(sdk.remotepay.DeviceErrorEventCode.InvalidConfig);
        errorResponse.setMessage("Cannot determine device to use.  " +
          "Device " + this.configuration.deviceSerialId + " not in set returned.");
        this.delegateCloverConnectorListener.onDeviceError(errorResponse);
    } else {
        // Stations do not support the kiosk/pay display.
        // If the user has selected one, then print out a (loud) warning
        if (myDevice.model == "Clover_C100") {
            this.log.warn(
              "Warning - Selected device model (" +
              devices[this.configuration.deviceSerialId].model +
              ") does not support cloud pay display." +
              "  Will attempt to send notification to device, but no response" +
              " should be expected.");
        }
        this.configuration.deviceId = myDevice.id;
        this.initializeConnection();
    }
};

/**
 * Handle a set of devices.  Sets up an internal map of devices from serial->device
 * @private
 * @param devicesVX
 */
CloverConnectorImpl.prototype.buildMapOfSerialToDevice = function (devicesVX) {
    var devices = null;
    var deviceBySerial = {};
    // depending on the version of the call, the devices might be in a slightly different format.
    // We would need to determine what devices were capable of doing what we want.  This means we
    // need to know if the device has the websocket connection enabled.  The best way to do this is
    // to make a different REST call, but we could filter the devices here.
    if (devicesVX['devices']) {
        devices = devicesVX.devices;
    }
    else if (devicesVX['elements']) {
        devices = devicesVX.elements;
    }
    if (devices) {
        var i;
        for (i = 0; i < devices.length; i++) {
            deviceBySerial[devices[i].serial] = devices[i];
        }
    }
    return deviceBySerial;
};

/**
 * @private
 */
CloverConnectorImpl.prototype.getAuthToken  = function() {
    this.cloverOAuth = new CloverOAuth2(this.configuration);
    return this.cloverOAuth.getAccessToken(
      // recurse
      function(token) {
          this.configuration.oauthToken = token;
          this.initializeConnection();
      }.bind(this)
    );
};

/**
 * @private
 * @param {Endpoints} endpoints
 */
CloverConnectorImpl.prototype.sendNotificationToDevice = function(endpoints) {
    var xmlHttpSupport = new XmlHttpSupport();
    var noDashesDeviceId = this.configuration.deviceId.replace(/-/g, "");
    var deviceContactInfo = new DeviceContactInfo(noDashesDeviceId, true);
    xmlHttpSupport.postData(endpoints.getAlertDeviceEndpoint(this.configuration.merchantId),
      function(data) { this.deviceNotificationSent(endpoints, deviceContactInfo, data);}.bind(this),
      function(error) {
          var errorResponse = new sdk.remotepay.CloverDeviceErrorEvent();
          errorResponse.setType(sdk.remotepay.ErrorType.COMMUNICATION);
          errorResponse.setCode(sdk.remotepay.DeviceErrorEventCode.SendNotificationFailure);
          errorResponse.setMessage("Error sending alert to device." + error);
          this.delegateCloverConnectorListener.onDeviceError(errorResponse);
      }.bind(this),
      deviceContactInfo);
};

/**
 *  The format of the data received is:
 * {
*     'sent': true | false,
*     'host': web_socket_host,
*     'token': token_to_link_to_the_device
* }
 *  Use this data to build the web socket url
 *  Note "!data.hasOwnProperty('sent')" is included to allow for
 *  backwards compatibility.  If the property is NOT included, then
 *  we will assume an earlier version of the protocol on the server,
 *  and assume that the notification WAS SENT.
 *
 * @private
 * @param {Endpoints} endpoints
 * @param {DeviceContactInfo} deviceContactInfo
 * @param {NotificationResponse} data
 */
CloverConnectorImpl.prototype.deviceNotificationSent = function(endpoints, deviceContactInfo, data) {
    // When using the cloud, we need to be able to send another notification to bootstrap
    // the device.  Set a boot strap function on the device to do this on reconnect.
    var xmlHttpSupport = new XmlHttpSupport();
    this.device.bootStrapReconnect = function(callback) {
        xmlHttpSupport.postData(endpoints.getAlertDeviceEndpoint(this.configuration.merchantId),
          callback, callback, deviceContactInfo);
    }.bind(this);
    // Note "!data.hasOwnProperty('sent')" is included to allow for
    // backwards compatibility.  If the property is NOT included, then
    // we will assume an earlier version of the protocol on the server,
    // and assume that the notification WAS SENT.
    if (!data.hasOwnProperty('sent') || data.sent) {
        var url = data.host + Endpoints.WEBSOCKET_PATH + '?token=' + data.token;
        this.log.debug("Server responded with information on how to contact device. " +
          "Opening communication channel...");
        // The response to this will be reflected in the device.onopen method (or on error),
        // That function will attempt the discovery.
        this.configuration.deviceURL = url;
        //recurse
        this.device.contactDevice(this.configuration.deviceURL);
    } else {
        var errorResponse = new sdk.remotepay.CloverDeviceErrorEvent();
        errorResponse.setCode(sdk.remotepay.DeviceErrorEventCode.SendNotificationFailure);
        errorResponse.setMessage("Error sending alert to device. Device is not connected to server.");
        this.delegateCloverConnectorListener.onDeviceError(errorResponse);
    }
};

/**
 * Send a signature acceptance
 * @param {remotepay.VerifySignatureRequest} request
 * @return void
 */
CloverConnectorImpl.prototype.acceptSignature = function(request) {
    var payment = request.getPayment();
    var protocolRequest = new sdk.remotemessage.SignatureVerifiedMessage();
    protocolRequest.setPayment(payment);
    protocolRequest.setVerified(true);
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Accepts a payment that has been challenged.
 * @param {payments.Payment} payment
 * @return void
 */
CloverConnectorImpl.prototype.acceptPayment = function(payment) {
    var protocolRequest = new sdk.remotemessage.PaymentConfirmedMessage();
    protocolRequest.setPayment(payment);
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Rejects a payment that has been challenged.
 * @param {payments.Payment} payment
 * @param {base.Challenge} challenge
 * @return void
 */
CloverConnectorImpl.prototype.rejectPayment = function(payment, challenge) {
    var protocolRequest = new sdk.remotemessage.PaymentRejectedMessage();
    protocolRequest.setPayment(payment);
    protocolRequest.setVoidReason(challenge.getReason());
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Request an authorization operation.
 * @param {remotepay.AuthRequest} request
 * @return void
 */
CloverConnectorImpl.prototype.auth = function(request) {
    var protocolRequest = new sdk.remotemessage.TxStartRequestMessage();
    this.verifyValidAmount(request.getAmount());

    var payIntent = this.populateBasePayIntent(request);
    payIntent.setTaxAmount(request.getTaxAmount());

    payIntent.setIsDisableCashBack(request.getDisableCashback() === undefined
      ? this.configuration.disableCashback : request.getDisableCashback());
    payIntent.setAllowOfflinePayment(request.getAllowOfflinePayment() === undefined
      ? this.configuration.allowOfflinePayment : request.getAllowOfflinePayment());
    payIntent.setApproveOfflinePaymentWithoutPrompt(request.getApproveOfflinePaymentWithoutPrompt() === undefined
      ? this.configuration.approveOfflinePaymentWithoutPrompt : request.getApproveOfflinePaymentWithoutPrompt());

    protocolRequest.setSuppressOnScreenTips(true);

    protocolRequest.setPayIntent(payIntent);
    this.lastRequest = request;

    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * @private
 * @param {remotepay.TransactionRequest} request
 */
CloverConnectorImpl.prototype.populateBasePayIntent = function(request) {
    var payIntent = new sdk.remotemessage.PayIntent();
    if(!request.getExternalId()) {
        throw new CloverError(CloverError.INVALID_DATA, "externalId is required");
    }
    payIntent.setExternalPaymentId(request.getExternalId()); //
    // Following maps exactly, but different types are attempt to isolate
    // remotemessage <-> remotepay
    //noinspection JSCheckFunctionSignatures
    payIntent.setTransactionType(request.getType());//
    payIntent.setAmount(request.getAmount()); //
    payIntent.setVaultedCard(request.getVaultedCard());//
    payIntent.setIsCardNotPresent(request.getCardNotPresent()); //

    payIntent.setCardEntryMethods(request.getCardEntryMethods() === undefined //
      ? this.configuration.cardEntryMethods : request.getCardEntryMethods());
    payIntent.setDisableRestartTransactionWhenFailed(request.getDisableRestartTransactionOnFail() === undefined //
      ? this.configuration.disableRestartTransactionWhenFailed : request.getDisableRestartTransactionOnFail());
    payIntent.setRemotePrint(request.getDisablePrinting() === undefined //
      ? this.configuration.remotePrint : request.getDisablePrinting());
    payIntent.setRequiresRemoteConfirmation(true);

    // employeeId? - "id": "DFLTEMPLOYEE"

    return payIntent;
};

/**
 * @private
 * @param {Number} amount - an integer
 * @param {Boolean} [allowZero] - if true then the amount can be zero
 * @throws {CloverError} if the amount is undefined, not an integer or not positive
 */
CloverConnectorImpl.prototype.verifyValidAmount = function (amount, allowZero) {
    if ((amount === undefined) || !CloverConnectorImpl.isInt(amount) || (amount < 0) || (!allowZero && amount === 0)) {
        throw new CloverError(CloverError.INVALID_DATA, "Amount must be an integer with a value greater than 0");
    }
};

/**
 * Request a preauth operation.
 * @param {remotepay.PreAuthRequest} preAuthRequest
 * @return void
 */
CloverConnectorImpl.prototype.preAuth = function(preAuthRequest) {
    var protocolRequest = new sdk.remotemessage.TxStartRequestMessage();
    this.verifyValidAmount(preAuthRequest.getAmount());

    var payIntent = this.populateBasePayIntent(preAuthRequest);

    protocolRequest.setPayIntent(payIntent);
    this.lastRequest = preAuthRequest;

    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Request a cancel be sent to the device.
 * @return void
 */
CloverConnectorImpl.prototype.cancel = function() {
    var protocolRequest = new sdk.remotemessage.KeyPressMessage();
    protocolRequest.setKeyPress(sdk.remotemessage.KeyPress.ESC);
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Request a preauth be captured.
 * @param {remotepay.CapturePreAuthRequest} capturePreAuthRequest
 * @return void
 */
CloverConnectorImpl.prototype.capturePreAuth = function(capturePreAuthRequest) {
    var protocolRequest = new sdk.remotemessage.CapturePreAuthMessage();
    this.verifyValidAmount(capturePreAuthRequest.getAmount());

    protocolRequest.setAmount(capturePreAuthRequest.getAmount());
    protocolRequest.setTipAmount(capturePreAuthRequest.getTipAmount());
    protocolRequest.setPaymentId(capturePreAuthRequest.getPaymentId());

    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Request a closeout.
 * @param {remotepay.CloseoutRequest} closeoutRequest
 * @return void
 */
CloverConnectorImpl.prototype.closeout = function(closeoutRequest) {
    var protocolRequest = new sdk.remotemessage.CloseoutRequestMessage();

    protocolRequest.setAllowOpenTabs(closeoutRequest.getAllowOpenTabs());
    protocolRequest.setBatchId(closeoutRequest.getBatchId());

    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Show the customer facing receipt option screen for the specified credit
 * @param {string} orderId
 * @param {string} creditId
 * @return void
 */
/*
 v2
 showManualRefundReceiptOptions = function(orderId, creditId) {
 // Waiting on changes in remote-pay.
 throw new CloverError(CloverError.NOT_IMPLEMENTED);
 };
 */

/**
 * Show the customer facing receipt option screen for the specified payment
 * @param {string} orderId
 * @param {string} paymentId
 * @return void
 */
CloverConnectorImpl.prototype.showPaymentReceiptOptions = function(orderId, paymentId) {
    var protocolRequest = new sdk.remotemessage.ShowPaymentReceiptOptionsMessage();

    protocolRequest.setOrderId(orderId);
    protocolRequest.setPaymentId(paymentId);

    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Show the customer facing receipt option screen for the specified payment refund
 * @param {string} orderId
 * @param {string} refundId
 * @return void
 */

/**
 * Display orderObj information on the screen. Calls to this method will cause the DisplayOrder
 * to show on the clover device. If a DisplayOrder is already showing on the Clover device,
 * it will replace the existing DisplayOrder on the device.
 * @param {order.DisplayOrder} orderObj
 * @return void
 */
CloverConnectorImpl.prototype.showDisplayOrder = function(orderObj) {
    var protocolRequest = new sdk.remotemessage.OrderUpdateMessage();
    protocolRequest.setOrder(orderObj);
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Removes the Display orderObj information on the screen.
 * @param {DisplayOrder} orderObj
 * @return void
 */
CloverConnectorImpl.prototype.removeDisplayOrder = function(orderObj) {
    this.showWelcomeScreen();
};

/**
 * Notify device of a discount being added to the orderObj. The discount will then reflect in the displayOrder.
 * Note: This is independent of a discount being added to a display line item.
 * @param {order.DisplayDiscount} discountObj
 * @param {order.DisplayOrder} orderObj
 * @return void
 */
CloverConnectorImpl.prototype.discountAddedToDisplayOrder = function(discountObj, orderObj) {
    var protocolRequest = new sdk.remotemessage.OrderUpdateMessage();
    protocolRequest.setOrder(orderObj);
    var discountsAddedOperation = new sdk.order.operation.DiscountsAddedOperation();
    discountsAddedOperation.setOrderId(orderObj.getId());
    discountsAddedOperation.setIds([discountObj.getId()]);

    protocolRequest.setDiscountsAddedOperation(discountsAddedOperation);
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Notify device of a discount being removed to the orderObj. The discount will then reflect in the displayOrder.
 * Note: This is independent of a discount being removed to a display line item.
 * @param {order.DisplayDiscount} discount
 * @param {order.DisplayOrder} orderObj
 * @return void
 */
CloverConnectorImpl.prototype.discountRemovedFromDisplayOrder = function(discount, orderObj) {
    var protocolRequest = new sdk.remotemessage.OrderUpdateMessage();
    protocolRequest.setOrder(orderObj);
    var discountsDeletedOperation = new sdk.order.operation.DiscountsDeletedOperation();
    discountsDeletedOperation.setOrderId(orderObj.getId());
    discountsDeletedOperation.setIds([discount.getId()]);

    protocolRequest.setDiscountsDeletedOperation(discountsDeletedOperation);
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Notify device of a line item being added to the orderObj. The line item will then reflect in the displayOrder.
 * Note: This is independent of a line item being added to a display line item.
 * @param {order.DisplayLineItem} lineItem
 * @param {order.DisplayOrder} orderObj
 * @return void
 */
CloverConnectorImpl.prototype.lineItemAddedToDisplayOrder = function(lineItem, orderObj) {
    var protocolRequest = new sdk.remotemessage.OrderUpdateMessage();
    protocolRequest.setOrder(orderObj);
    var lineItemsAddedOperation = new sdk.order.operation.LineItemsAddedOperation();
    lineItemsAddedOperation.setOrderId(orderObj.getId());
    lineItemsAddedOperation.setIds([lineItem.getId()]);

    protocolRequest.setLineItemsAddedOperation(lineItemsAddedOperation);
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Notify device of a line item being removed to the orderObj. The line item will then reflect in the displayOrder.
 * Note: This is independent of a line item being removed to a display line item.
 * @param {order.DisplayLineItem} lineItem
 * @param {order.DisplayOrder} orderObj
 * @return void
 */
CloverConnectorImpl.prototype.lineItemRemovedFromDisplayOrder = function(lineItem, orderObj) {
    var protocolRequest = new sdk.remotemessage.OrderUpdateMessage();
    protocolRequest.setOrder(orderObj);
    var lineItemsDeletedOperation = new sdk.order.operation.LineItemsDeletedOperation();
    lineItemsDeletedOperation.setOrderId(orderObj.getId());
    lineItemsDeletedOperation.setIds([lineItem.getId()]);

    protocolRequest.setLineItemsDeletedOperation(lineItemsDeletedOperation);
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * This can be used internally, but will remain hidden for now.
 *
 * When called, it will return a tuple with the last transactional request sent to the Clover Mini, and
 * the corresponding response from the Mini if there was one (NULL if not). Works for sale, auth, manual refund
 * and refund.
 *
 * @private
 * @return void
 */
CloverConnectorImpl.prototype.getLastTransaction = function() {
    var protocolRequest = new sdk.remotemessage.LastMessageRequestMessage();
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Destroy the connector.  After this is called, the connection to the device is severed, and this object is
 * no longer usable
 * @return void
 */
CloverConnectorImpl.prototype.dispose = function() {
    if (this.device) {
        try {
            this.device.reconnect = false;
            this.cancel();
        } catch (e) {
            this.log.info(e);
        }
        try {
            this.log.info("Calling disconnectFromDevice");
            this.device.disconnectFromDevice();
        } catch (e) {
            this.log.info(e);
        }
        this.device = null;
    }
};

/**
 * @return void
 */
CloverConnectorImpl.prototype.reconnect = function() {
    if (this.device) {
        try {
            this.device.attemptReconnect();
        } catch (e) {
            this.log.info(e);
        }
    }
};

/**
 * Send a keystroke to the device.  When in non secure displays are on the device, this can be used to
 * act in the role of the user to 'press' available keys.
 * @param {remotemessage.InputOption} io
 * @return void
 */
CloverConnectorImpl.prototype.invokeInputOption = function(io) {
    var protocolRequest = new sdk.remotemessage.KeyPressMessage();
    protocolRequest.setKeyPress(io.getKeyPress());
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Do a refund to a card.
 * @param {remotepay.ManualRefundRequest} request
 * @return void
 */
CloverConnectorImpl.prototype.manualRefund = function(request) {
    var protocolRequest = new sdk.remotemessage.TxStartRequestMessage();
    this.verifyValidAmount(request.getAmount());

    var payIntent = this.populateBasePayIntent(request);
    // Negate the amount
    payIntent.setAmount(Math.abs(payIntent.getAmount()) * -1);
    protocolRequest.setPayIntent(payIntent);
    this.lastRequest = request;

    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Do a refund on a previously made payment.
 * @param {remotepay.RefundPaymentRequest} request
 * @return void
 */
CloverConnectorImpl.prototype.refundPayment = function(request) {
    var protocolRequest = new sdk.remotemessage.RefundRequestMessage();
    // In the initial and unspecified version, an amount of '0' indicated
    // a full refund.  In the version 2 of the message, the flag 'fullRefund' was
    // added.
    protocolRequest.setVersion(2);
    protocolRequest.setFullRefund(request.getFullRefund());
    if(!request.getFullRefund()) {
        this.verifyValidAmount(request.getAmount());
        protocolRequest.setAmount(request.getAmount())
    }
    protocolRequest.setOrderId(request.getOrderId());
    protocolRequest.setPaymentId(request.getPaymentId());
    this.lastRequest = request;

    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Open the first cash drawer that is found connected to the clover device.
 * @param {string} reason
 * @return void
 */
CloverConnectorImpl.prototype.openCashDrawer = function(reason) {
    var protocolRequest = new sdk.remotemessage.OpenCashDrawerMessage();
    protocolRequest.setReason(reason);
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Print the passed image. bitmap is a language specific object that represents an image.
 * @param {Img} bitmap - an HTML DOM IMG object.
 *
 * @return void
 */
CloverConnectorImpl.prototype.printImage = function(bitmap) {
    var protocolRequest = new sdk.remotemessage.ImagePrintMessage();
    protocolRequest.setPng(ImageUtil.getBase64Image(bitmap));
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Print an image on the clover device that is found at the passed url.
 * @param {string} imgUrl
 * @return void
 */
CloverConnectorImpl.prototype.printImageFromURL = function(imgUrl) {
    var protocolRequest = new sdk.remotemessage.ImagePrintMessage();
    protocolRequest.setUrlString(imgUrl);
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Print text on the clover device printer.
 * @param {Array.<String>} messages An array of
 * @return void
 */
CloverConnectorImpl.prototype.printText = function(messages) {
    var protocolRequest = new sdk.remotemessage.TextPrintMessage();
    protocolRequest.setTextLines(messages);
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Reject a signature
 * @param {remotepay.VerifySignatureRequest} request
 * @return void
 */
CloverConnectorImpl.prototype.rejectSignature = function(request) {
    var payment = request.getPayment();
    var protocolRequest = new sdk.remotemessage.SignatureVerifiedMessage();
    protocolRequest.setPayment(payment);
    protocolRequest.setVerified(false);
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Send a message to the device to reset back to the welcome screen.  Can be used when the device is in
 * an unknown state.
 * @return void
 */
CloverConnectorImpl.prototype.resetDevice = function() {
    var protocolRequest = new sdk.remotemessage.BreakMessage();
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Begin a sale transaction.
 * @param {remotepay.SaleRequest} request
 * @return void
 */
CloverConnectorImpl.prototype.sale = function(request) {
    var protocolRequest = new sdk.remotemessage.TxStartRequestMessage();
    this.verifyValidAmount(request.getAmount());

    var payIntent = this.populateBasePayIntent(request);
    payIntent.setTippableAmount(request.getTippableAmount());
    payIntent.setTipAmount(request.getTipAmount() == undefined ? 0 : request.getTipAmount());
    payIntent.setTaxAmount(request.getTaxAmount());

    payIntent.setIsDisableCashBack(request.getDisableCashback() === undefined
      ? this.configuration.disableCashback : request.getDisableCashback());
    payIntent.setAllowOfflinePayment(request.getAllowOfflinePayment() === undefined
      ? this.configuration.allowOfflinePayment : request.getAllowOfflinePayment());
    payIntent.setApproveOfflinePaymentWithoutPrompt(request.getApproveOfflinePaymentWithoutPrompt() === undefined
      ? this.configuration.approveOfflinePaymentWithoutPrompt : request.getApproveOfflinePaymentWithoutPrompt());

    // For sale tip is defined.  If no tip, then it is set to 0.
    protocolRequest.setPayIntent(payIntent);
    protocolRequest.setSuppressOnScreenTips(request.getDisableTipOnScreen());
    this.lastRequest = request;

    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Show a text message on the device.
 * @param {string} message
 * @return void
 */
CloverConnectorImpl.prototype.showMessage = function(message) {
    var protocolRequest = new sdk.remotemessage.TerminalMessage();
    protocolRequest.setText(message);
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Show the thank you display on the device.
 * @return void
 */
CloverConnectorImpl.prototype.showThankYouScreen = function() {
    var protocolRequest = new sdk.remotemessage.ThankYouMessage();
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Show the welcome display on the device.
 * @return void
 */
CloverConnectorImpl.prototype.showWelcomeScreen = function() {
    var protocolRequest = new sdk.remotemessage.WelcomeMessage();
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Tip adjust an existing auth
 * @param {remotepay.TipAdjustAuthRequest} request
 * @return void
 */
CloverConnectorImpl.prototype.tipAdjustAuth = function(request) {
    var protocolRequest = new sdk.remotemessage.TipAdjustMessage();
    this.verifyValidAmount(request.getTipAmount(), true);
    protocolRequest.setTipAmount(request.getTipAmount());
    protocolRequest.setOrderId(request.getOrderId());
    protocolRequest.setPaymentId(request.getPaymentId());

    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Vault a card using optional cardEntryMethods
 * @param {Number} cardEntryMethods must be an integer
 * @return void
 */
CloverConnectorImpl.prototype.vaultCard = function(cardEntryMethods) {
    var protocolRequest = new sdk.remotemessage.VaultCardMessage();
    cardEntryMethods =
      cardEntryMethods===undefined ? this.configuration.cardEntryMethods :
        CloverConnectorImpl.isInt(cardEntryMethods) ? cardEntryMethods :
          this.configuration.cardEntryMethods;
    protocolRequest.setCardEntryMethods(cardEntryMethods);
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(protocolRequest));
};

/**
 * Void a payment
 * @param {remotepay.VoidPaymentRequest} request
 * @return void
 */
CloverConnectorImpl.prototype.voidPayment = function(request) {
    var protocolRequest = new sdk.remotemessage.VoidPaymentMessage();

    var payment = new sdk.payments.Payment();
    payment.setId(request.getPaymentId());
    var orderReference = new sdk.base.Reference();
    orderReference.setId(request.getOrderId());
    payment.setOrder(orderReference);
    var employeeReference = new sdk.base.Reference();
    employeeReference.setId(request.getEmployeeId() == null
      ? this.configuration.defaultEmployeeId : request.getEmployeeId());
    payment.setEmployee(employeeReference);
    protocolRequest.setPayment(payment);
    protocolRequest.setVoidReason(sdk.order.VoidReason[request.getVoidReason()]);

    // Wait for an ACK... then call sendVoidPaymentResponse
    var remoteMessage = this.messageBuilder.buildRemoteMessageObject(protocolRequest);
    // This is a backwards compatibility hack.
    if(this.deviceSupportsAckMessages) {
        // If acknowledgements are supported, then
        // wait for an ACK from the device for the message.
        this.addAcknowledgementHook(remoteMessage.getId(), function () {
            this.sendVoidPaymentResponse(payment)
        }.bind(this));
    } else {
        //If not just send the response after 1 second.
        setTimeout(function () {
            this.sendVoidPaymentResponse(payment)
        }.bind(this), 1000);
    }
    this.sendMessage(remoteMessage);
};

/**
 * Returns information on the SDK.  This is a string that is identified by the SDK type, a colon, and the
 * version with any release candidate appended.
 * @return {String}
 */
CloverConnectorImpl.prototype.SDKInfo = function() {
    return CloverConnectorImpl.RemoteSourceSDK + ":" +
      CLOVER_CLOUD_SDK_VERSION;
};

/**
 * In some cases we want to get an acknowledgement of a message, then execute some functionality.
 * This allows for that.  The most obvious case of that is the 'voidPayment' call above.
 *
 * @private
 * @param {string} id the id of the message to wait for
 * @param {function} callback the function called when the acknowledgement is received.  Note that
 *  if no acknowledgement is ever received for the passed id, the callback will never be removed.
 */
CloverConnectorImpl.prototype.addAcknowledgementHook = function(id, callback) {
    if(!this.deviceSupportsAckMessages) {
        this.log.warn("addAcknowledgementHook called, but device does not support ACK messages.  " +
          "Callback will never be called or removed from internal acknowledgementHooks store.");
    }
    this.acknowledgementHooks[id] = callback;
};

/**
 * Add a listener that will be notified by this connector
 * @param {ICloverConnectorListener} connectorListener
 */
CloverConnectorImpl.prototype.addCloverConnectorListener = function(connectorListener) {
    this.cloverConnectorListeners.push(connectorListener);
};

/**
 * Remove a listener that will be notified by this connector
 * @param {ICloverConnectorListener} connectorListener
 */
CloverConnectorImpl.prototype.removeCloverConnectorListener = function(connectorListener) {
    var indexOfListener = this.cloverConnectorListeners.indexOf(connectorListener);
    if(indexOfListener !== -1) {
        this.cloverConnectorListeners.splice(indexOfListener, 1);
    }
};

/**
 * Used internally
 * @protected
 * @returns {Array}
 */
CloverConnectorImpl.prototype.getListeners = function() {
    return this.cloverConnectorListeners;
};

/**
 * Used internally
 * @protected
 * @param {remotemessage.LogLevelEnum} logLevel - the logging level
 * @param {Object} messages - a mappiing of string->string that is passed directly in the message
 */
CloverConnectorImpl.prototype.logMessageRemotely = function(logLevel, messages) {
    var logMessage = new sdk.remotemessage.LogMessage();
    logMessage.setLogLevel(logLevel);
    logMessage.setMessages(messages);
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(logMessage));
};

CloverConnectorImpl.prototype.retrievePendingPayments = function() {
    var retrievePendingPaymentsMessage = new sdk.remotemessage.RetrievePendingPaymentsMessage();
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(retrievePendingPaymentsMessage));
};

/**
 * Sends a request to read card information and call back with the information collected.
 * @see ICloverConnectorListener.onReadCardDataResponse(ReadCardDataResponse)
 * @memberof sdk.remotepay.ICloverConnector
 *
 * @param {remotepay.ReadCardDataRequest} request
 * @return void
 */
CloverConnectorImpl.prototype.readCardData = function(request) {
    var cardDataRequestMessage = new sdk.remotemessage.CardDataRequestMessage();
    var payIntent = new sdk.remotemessage.PayIntent();
    payIntent.setTransactionType(sdk.remotemessage.TransactionType.DATA);
    payIntent.setIsForceSwipePinEntry(request.getIsForceSwipePinEntry());
    payIntent.setCardEntryMethods(request.getCardEntryMethods());
    cardDataRequestMessage.setPayIntent(payIntent);
    this.sendMessage(this.messageBuilder.buildRemoteMessageObject(cardDataRequestMessage));
};


/**
 * @private
 * @param value
 * @returns {boolean}
 */
CloverConnectorImpl.isInt = function(value) {
    var x;
    if (isNaN(value)) {
        return false;
    }
    x = parseFloat(value);
    return (x | 0) === x;
};

CloverConnectorImpl.WebSocketPackage = "com.clover.remote.protocol.websocket";
CloverConnectorImpl.NetworkPackage = "com.clover.remote.protocol.lan";
CloverConnectorImpl.RemoteSourceSDK = "com.clover.cloverconnector.cloud";

CloverConnectorImpl.KEY_Package = "code_package";
CloverConnectorImpl.KEY_FriendlyId = "friendlyId";

/**
 * The shutdown method type
 * This is a special type only present in the cloud adaptor.
 */
CloverConnectorImpl.SHUTDOWN = "SHUTDOWN";

/**
 * The acknowledgement method type
 * This is a special type only present in the cloud adaptor.
 */
CloverConnectorImpl.ACK = "ACK";

/**
 * The acknowledgement method type
 * This is a special type only present in the cloud adaptor.
 */
CloverConnectorImpl.ERROR = "ERROR";

//
// Expose the module.
//
//noinspection JSUnresolvedVariable
if ('undefined' !== typeof module) {
    //noinspection JSUnresolvedVariable
    module.exports = CloverConnectorImpl;
}

/**
 * @typedef {Object} NotificationResponse the result of a notification request.  Contains
 *  information on how to connect to a device
 * @property {boolean} sent
 * @property {string} host
 * @property {string} token
 */

