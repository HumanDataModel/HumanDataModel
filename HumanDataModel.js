// PHASE 1: data input filtering and handling
// PHASE 2: higher level sensation generators
// PHASE 3: sensation callbacks    


var log = console.log;
log('Physical-Cyber-Social model');

function isNode() {
    return (typeof module !== 'undefined' && module.exports);
}



var HumanDataModel = function () {

    var model = {

        username: '',

        identity: '',

        companionUUID: '',

        // Facebook data set dynamically when received from client

        facebookID: '',
        facebookName: '',
        facebookFriends: [],


        // Contains seeds from other hd models online
        seeds: {},


        // my own devices
        devices: {},


        proxemicUsers: {},
        proxemicDevices: {},

        unknownProxemicDevices: {}
    };

    // PHASE 1
    var inputListeners = {};

    // PHASE 2
    var sensationUpdateTimes = {};
    var sensationGenerators = {};
    var dataToSensationsMappings = {};

    // PHASE 3
    var sensationCallbacks = {
        local: {}
    };

    var connectors = {};
    var that = {};


    var seedDispatcher;



    // PUBLIC METHODS

    // INITIALIZING

    // Starts the whole thing
    that.startHDmodel = function () {
        log('Starting HDM');
        initializeHDmodel();
    };

    that.addSeed = function (seed) {
        log('Adding seed to HDM');
        that.model.username = seed.username;
        that.model.identity = seed.identity;
        that.model.companionUUID = seed.companionUUID;
        that.model.facebookID = seed.facebookID;
        that.model.devices = seed.devices;
    };



    // PHASE 1

    that.addInputListener = function (inputDataType, inputListener) {
        inputListeners[inputDataType] = inputListener;
        log('Input listener addded for: ' + inputDataType);
    };


    // PHASE 2

    that.addSensationGenerator = function (sensationType, triggeringInputDataTypes, maxInterval, validTime, generatorMethod) {
        log('Sensation generator for: ' + sensationType);

        // name: when last called, function to call, maxInterval (how often can be invoked)
        sensationGenerators[sensationType] = {
            lastCalled: null,
            generator: generatorMethod,
            maxInterval: maxInterval,
            validTime: validTime
        };

        log(triggeringInputDataTypes);
        var
            index,
            inputDataType;
        for (index in triggeringInputDataTypes) {
            inputDataType = triggeringInputDataTypes[index];
            if (!dataToSensationsMappings[inputDataType]) {
                dataToSensationsMappings[inputDataType] = [];
            }
            dataToSensationsMappings[inputDataType].push(sensationType);
        }

        log(dataToSensationsMappings);
    };


    // PHASE 3

    that.addCallbackForSensation = function (sensationName, callback) {
        log('Call back for sensation: ' + sensationName);

        if (!sensationGenerators[sensationName]) {
            throw "Cannot add callback: Unknown sensation type: " + sensationName;
        }

        // For direct/local subsribers
        sensationCallbacks['local'][sensationName] = callback;

    };




    //////////// DISPATCHER - MAIN METHOD


    that.dispatch = function (senderId, inputData) {

        log('raw data received:');
        log(inputData);

        var
            i,
            keysOfReceivedData = Object.keys(inputData);
        for (i = 0; i < keysOfReceivedData.length; i += 1) {

            var dataType = keysOfReceivedData[i];
            if (Object.keys(inputListeners).indexOf(dataType) !== -1) {

                log('Handling data for key: ' + dataType);
                inputListeners[dataType](model, inputData[dataType]);

                // invoke the sensation generators

                var j,
                    key,
                    sensationGeneratorKeys = dataToSensationsMappings[dataType];
                log(sensationGeneratorKeys);
                for (j = 0; j < sensationGeneratorKeys.length; j += 1) {
                    key = sensationGeneratorKeys[j];
                    var generatorInfo = sensationGenerators[key];


                    // TODO: check the interval


                    // invoke method
                    var sensationToPublish = generatorInfo.generator(model);
                    //model[key] = sensationToPublish.sensationValue;
                    sensationUpdateTimes[key] = Date.now();

                    // publish to local
                    var localCallbackForSensation = sensationCallbacks['local'][key];
                    if (!localCallbackForSensation) {
                        return;
                    }

                    // Add the md5 so that the client can decide if it reacts to the sensation
                    var oldMD5 = getHashForSensationType(key);
                    sensationToPublish.md5 = oldMD5;

                    localCallbackForSensation(sensationToPublish);


                    // TODO: publish for global subscribers


                    // check for validity

                    setTimeout(function () {
                        var newMD5 = getHashForSensationType(key);
                        if (sensationUpdateTimes[key] && newMD5 === oldMD5) {
                            log('SAME VALUE TOO LONG for ' + key + ' (' + generatorInfo.validTime + '): ' + oldMD5 + ' vs. ' + newMD5);
                            model[key] = {};
                            var sensationToPublish = {
                                sensationType: key,
                                sensationValue: model[key],
                                md5: newMD5
                            };

                            localCallbackForSensation(sensationToPublish);
                        }
                    }, generatorInfo.validTime * 1000);


                }

            }

            // TODO: check data type (HD_sensation_types define also the input data)

            // TODO: merge to the model
        }
    };

    that.getSeed = function (to_identity) {
        return {
            username: model.username,
            identity: model.identity,
            facebookID: model.facebookID,
            companionUUID: model.companionUUID,
            devices: model.devices
        };
    };

    that.addDispatcher = function (dispatcherMethod) {
        seedDispatcher = dispatcherMethod;
    };

    that.broadcastSeed = function () {
        seedDispatcher('seed_broadcast', model.identity, that.getSeed());
    };

    that.newSeedBroadcastReceived = function (hdmIdentity, seedData) {
        model.seeds[hdmIdentity] = seedData;
        // dispatch seed to the newcomer, but not to self
        if (hdmIdentity !== model.identity) {
            log('sending hdm seed');
            seedDispatcher('seed_broadcast_reply', seedData.identity, that.getSeed());
        }
    };

    that.newSeedBroadcastReplyReceived = function (hdmIdentity, seedData) {
        model.seeds[seedData.identity] = seedData;
        // dispatch seed to the newcomer, but not to self
    };

    // PRIVATE METHODS

    function initializeHDmodel() {
        log('Initializing Physical-Cyber-Social model');
        that.model = model;
    }


    function getHashForSensationType(sensationType) {
        var datadataJsonString = model[sensationType] ? JSON.stringify(model[sensationType]) : '';
        var lastUpdateTime = sensationUpdateTimes[sensationType];
        return md5(datadataJsonString + lastUpdateTime);
    }



    that.getDeviceByUUID = function (deviceUUID) {
        log('getting: ' + deviceUUID);
        var device = {
                identity: '',
                companion: false,
                uuid: '',
                ownDevice: false
            },
            seedKey;

        for (seedKey in that.model.devices) {
            if (that.model.devices.hasOwnProperty(seedKey)) {
                if (Object.keys(that.model.devices).indexOf(deviceUUID) !== -1) {
                    device.identity = that.model.devices[deviceUUID];
                    device.companion = model.companionUUID === deviceUUID;
                    device.uuid = deviceUUID;
                    device.username = device.identity.split('@', 1)[0];
                    device.ownDevice = true;
                    log('Own device');
                    return device;
                }
            }
        }

        for (seedKey in that.model.seeds) {
            if (that.model.seeds.hasOwnProperty(seedKey)) {
                if (that.model.seeds[seedKey].devices.hasOwnProperty(deviceUUID)) {
                    device.identity = that.model.seeds[seedKey].devices[deviceUUID];
                    device.companion = that.model.seeds[seedKey].companionUUID === deviceUUID;
                    device.uuid = deviceUUID;
                    device.username = device.identity.split('@', 1)[0];
                    device.ownDevice = false;
                    log('Others device');
                    return device;
                }
            }

        }

        // If nothing found, return empty undefined
        return undefined;
    }


    return that;
};









/// Initialize

var hdModel = HumanDataModel();
hdModel.startHDmodel();


////////// PHASE 1

hdModel.addInputListener('facebook_friends', function (theModel, facebookFriends) {

    theModel.facebookFriends = {};
    var seedId;
    for (seedId in theModel.seeds) {
        if (theModel.seeds.hasOwnProperty(seedId)) {

            var username = theModel.seeds[seedId].username;
            var fbFriendIDs = Object.keys(facebookFriends);
            log(username + ' is:');
            log(Object.keys(facebookFriends).indexOf(theModel.seeds[seedId].facebookID));
            if (fbFriendIDs.indexOf(theModel.seeds[seedId].facebookID) !== -1) {
                theModel.facebookFriends[username] = facebookFriends[fbFriendIDs[Object.keys(facebookFriends).indexOf(theModel.seeds[seedId].facebookID)]];
                log('friend');
            } else {
                log('not friend');
            }
        }
    }
});


hdModel.addInputListener('ble_devices', function (theModel, proximitySet) {

    theModel.proxemicDevices = {};
    theModel.proxemicUsers = {};

    var
        measuredUsername,
        measuredDeviceId,
        unknownDevicesIndex = 0,
        bleIdentity,
        rssiValue;
    for (bleIdentity in proximitySet) {
        if (proximitySet.hasOwnProperty(bleIdentity)) {

            rssiValue = proximitySet[bleIdentity];

            var measuredDevice = hdModel.getDeviceByUUID(bleIdentity);
            if (measuredDevice) {
                if (measuredDevice.companion) {
                    theModel.proxemicUsers[measuredDevice.username] = rssiValue;
                }
                theModel.proxemicDevices[measuredDevice.identity] = rssiValue;

            } else {
                // unknown device
                theModel.unknownProxemicDevices["unknown_" + unknownDevicesIndex] = rssiValue;
                unknownDevicesIndex += 1;
            }
        }
    }
});

hdModel.addInputListener('gps_coordinates', function (theModel, coordinates) {
    theModel.location = {};
    theModel.location['latitude'] = coordinates.latitude;
    theModel.location['longitude'] = coordinates.longitude;
});



////////// PHASE 2



// hd sensation type (name), array of inputs that trigger the generator, 
// interval in seconds (how fast/often the generator can be called), and 
// value indicating how long the sensation is valid
hdModel.addSensationGenerator('social_proximity_set', ['ble_devices', 'facebook_friends'], 3, 5, function (theModel) {

    // the the fb data
    console.log('SOCIAL PROXIMITY GRAPH CHANGED EVENT');

    var sensation = {
        sensationType: 'social_proximity_set',
        sensationValue: {
            friends: {}
        }
    };

    var user;
    for (user in theModel.proxemicUsers) {
        if (theModel.proxemicUsers.hasOwnProperty(user)) {
            log('friend: ' + user);
            if (Object.keys(theModel.facebookFriends).indexOf(user) !== -1) {
                sensation.sensationValue.friends[user] = theModel.facebookFriends[user];
            }
        }
    }

    log(sensation);

    return sensation;
});


// hd sensation type (name), array of inputs that trigger the generator, 
// interval in seconds (how fast/often the generator can be called), and 
// value indicating how long the sensation is valid
hdModel.addSensationGenerator('location', ['gps_coordinates'], 3, 10, function (theModel) {

    // Generate location output sensations

    var sensation = {
        sensationType: 'location',
        sensationValue: {
            location: {
                latitude: theModel.location.latitude,
                longitude: theModel.location.longitude
            }
        }
    };

    return sensation;
});



/// Start

var bob = {
    username: "bob",
    identity: "bob@hd",
    companionUUID: "FB694B90-F49E-4597-8306-171BBA78F844",
    facebookID: "102684690214746",
    devices: {
        "5BF2E050-4730-46DE-B6A7-2C8BE4D9FA36": "bob@iphoneSE",
        "FB694B90-F49E-4597-8306-171BBA78F844": "bob@mac"
    }
};


var alice = {
    username: "alice",
    identity: "alice@hd",
    companionUUID: "717F860E-F0E6-4C93-A4E3-CC724D27E05E",
    facebookID: "119560198524790",
    devices: {
        "717F860E-F0E6-4C93-A4E3-CC724D27E05E": "alice@iphone",
        "8B034F7B-FA9B-540F-ACF3-88C0CA70C84F": "alice@ibeacon"
    }
};

var nkm = {
    username: "nkm",
    identity: "nkm@hd",
    companionUUID: "717F860E-F0E6-4C93-A4E3-CC724D27E05B",
    facebookID: "120144918465781",
    devices: {
        "717F860E-F0E6-4C93-A4E3-CC724D27E05E": "nkm@iphone5"
    }
};

var connector;
if (isNode()) {

    log('Node.js');

    var setUser = bob;
    hdModel.addSeed(bob);

    var NodeJSConnector = require('./connectors/nodeJSConnector.js');
    connector = new NodeJSConnector(hdModel);

} else {

    log('NOT Node.js');

    function askIdentity() {
        var setUser,
            inputIdentity = prompt("Please enter your username", "alice");

        if (inputIdentity != null && inputIdentity === 'alice') {
            setUser = alice;
        } else if (inputIdentity != null && inputIdentity === 'bob') {
            setUser = bob;
        } else if (inputIdentity != null && inputIdentity === 'nkm') {
            setUser = nkm;
        } else {

            return;
        }

        hdModel.addSeed(setUser);

        requirejs(["connectors/connectorForJS", "libs/md5"], function (connector) {
            initializeConnector(hdModel);

            setTimeout(function () {
                hdModel.broadcastSeed();
            }, 2000);

        });
    }

    askIdentity();

}