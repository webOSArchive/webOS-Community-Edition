/* Copyright 2009 Palm, Inc.  All rights reserved. */
/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global _, Globalization, Future, SpeedDialHash, SpeedDialBackup, Foundations, ContactLinkable, Utils */


/*
 * Used to save speed dials while a person is being edited.  The common use case for this is during fixup.
 */
var SpeedDialSaver = function (personOrPersons) {
	this.savedSpeedDials = [];
	
	var that = this,
		personArray;
	
	if (personOrPersons) {
		//make the argument an array if it's not already
		personArray = _.isArray(personOrPersons) ? personOrPersons : [personOrPersons];
		this.people = personArray;
		
		personArray.forEach(function (person) {
			//for each person we're passed, find the phone numbers that have speed dials and store them
			if (person) {
				person.getPhoneNumbers().getArray().forEach(function (phoneNumber) {
					var speedDial = phoneNumber.getSpeedDial();

					if (speedDial) {
						that.savedSpeedDials.push({
							speedDial: speedDial,
							value: phoneNumber.getValue(),
							person: person
						});
					}
				});
			}
		});
	}
};

SpeedDialSaver.prototype.saveBackupRecordsForSpeedDials = function () {
	var contactLinkHashCache = {},
		future = new Future(),
		speedDialHashes = {};
	
	future.now(this, function () {
		this.savedSpeedDials.forEach(function (speedDial) {
			var tempSpeedDialHash = new SpeedDialHash({
				key: speedDial.speedDial
			});

			tempSpeedDialHash.setPlainValue(speedDial.value);
			
			if (!speedDialHashes[speedDial.person.getId()]) {
				speedDialHashes[speedDial.person.getId()] = [];
				speedDialHashes[speedDial.person.getId()].push(tempSpeedDialHash);
			} else {
				speedDialHashes[speedDial.person.getId()].push(tempSpeedDialHash);
			}
		});
		
		return Foundations.Control.mapReduce({
			map: function (person) {
				var mapFuture = new Future(),
					contactLinkHashes = [],
					toMapReduce = [];

				// If we don't have the contacts from the person, reload them.
				mapFuture.now(function () {
					if (person.getContacts().length === 0) {
						return person.reloadContacts();
					} else {
						return true;
					}
				});

				// Get the linkHashes for all of the contacts on this person
				mapFuture.then(function () {
					var result = mapFuture.result;

					return Foundations.Control.mapReduce({
						map: function (contact) {
							var contactLinkHashFuture = new Future();

							contactLinkHashFuture.now(function () {
								// Check for it in the cache first. 
								if (!contactLinkHashCache[contact.getId()]) {
									// If it wasn't in the cache then we have to fetch it.
									return ContactLinkable.getLinkHash(contact).then(function (getLinkHashFuture) {
										var result = getLinkHashFuture.result;

										contactLinkHashes.push(result.linkHash);
										contactLinkHashCache[contact.getId()] = result.linkHash;
										return true;
									});
								} else {
									return true;
								}
							});

							return contactLinkHashFuture;
						}
					}, person.getContacts());
				});

				// Get the backups for the link hashes from the db and save the updated data. Create any
				// new backup records for entries not currently in the db.
				mapFuture.then(function () {
					var dummy = future.result;
					
					return Foundations.Control.mapReduce({
						map: function (contactLinkHash) {
							var getLinkHashBackupFuture = new Future();

							getLinkHashBackupFuture.now(function () {
								return SpeedDialBackup.getBackupForLinkHash(contactLinkHash);
							});

							getLinkHashBackupFuture.then(function () {
								var result = getLinkHashBackupFuture.result,
									tempBackup;

								if (result) {
									tempBackup = result;
								} else {
									tempBackup = new SpeedDialBackup({
										contactBackupHash: contactLinkHash,
										speedDials: []
									});
								}

								tempBackup.getSpeedDials().clear();
								if (speedDialHashes[person.getId()] && speedDialHashes[person.getId()].length > 0) {
									tempBackup.getSpeedDials().add(speedDialHashes[person.getId()]);
									toMapReduce.push({"function": tempBackup.save, object: tempBackup});
								} else if (tempBackup.getId()) {
									toMapReduce.push({"function": tempBackup.deleteSpeedDialBackup, object: tempBackup});
								}
								
								return true;
							});

							return getLinkHashBackupFuture;
						}
					}, contactLinkHashes);
				});

				// Save the updates of the speed dial backups to the db
				mapFuture.then(function () {
					var dummy = mapFuture.result;
					
					return Utils.mapReduceAndVerifyResultsTrue(toMapReduce);
				});

				return mapFuture;
			}
		}, this.people);
	});
	
	return future;
};

/*
 * Restores any speed dials possible onto the new person.  Does not save the person.
 */
SpeedDialSaver.prototype.restoreSpeedDials = function (personToRestoreTo) {
	//for each saved speed dial, look for the match phone number on the personToRestoreTo and if we find it, resave the speed dial
	this.savedSpeedDials.forEach(function (savedSpeedDial) {
		var matchingPhoneNumber = _.detect(personToRestoreTo.getPhoneNumbers().getArray(), function (phoneNumber) {
			var matchQuality = Globalization.Phone.comparePhoneNumbers(phoneNumber.getValue(), savedSpeedDial.value);
			return matchQuality > 0;
		});
		
		if (matchingPhoneNumber) {
			matchingPhoneNumber.setSpeedDial(savedSpeedDial.speedDial);
		}
	});
};

SpeedDialSaver.prototype.restoreSpeedDialsFromBackups = function (personToRestoreTo) {
	var future = new Future();
	
	future.now(this, function () {
		return this.getLinkHashesForPeople();
	});
	
	future.then(this, function () {
		var linkHashes = future.result;
		
		return SpeedDialBackup.getBackupsForLinkHashes(linkHashes);
	});
	
	future.then(this, function () {
		var backupRecords = future.result;
		
		backupRecords.forEach(function (backupRecord) {
			var speedDials = backupRecord.getSpeedDials().getArray();
			
			speedDials.forEach(function (speedDial) {
				personToRestoreTo.getPhoneNumbers().getArray().some(function (phoneNumber) {
					if (speedDial.isPlainValueEqual(phoneNumber.getValue())) {
						// Allow local speed dials to override backup records
						if (!phoneNumber.getSpeedDial()) {
							phoneNumber.setSpeedDial(speedDial.getKey());
							return true;
						}
					}
					
					return false;
				});
			});
		});
		
		return true;
	});
	
	return future;
};

/*
 * Restores any speed dials from the speed dial backup table. Does not save the person.
 */
SpeedDialSaver.prototype.getLinkHashesForPeople = function () {
	var future = new Future(),
		contactLinkHashes = [],
		contactLinkHashCache = {};
	
	future.now(this, function () {
		return Foundations.Control.mapReduce({
			map: function (person) {
				var mapFuture = new Future(),
					toMapReduce = [];
			
				// If we don't have the contacts from the person, reload them.
				mapFuture.now(function () {
					if (person.getContacts().length === 0) {
						return person.reloadContacts();
					} else {
						return true;
					}
				});

				// Get the linkHashes for all of the contacts on this person
				mapFuture.then(function () {
					var result = mapFuture.result;

					return Foundations.Control.mapReduce({
						map: function (contact) {
							var contactLinkHashFuture = new Future();

							contactLinkHashFuture.now(function () {
								// Check for it in the cache first. 
								if (!contactLinkHashCache[contact.getId()]) {
									// If it wasn't in the cache then we have to fetch it.
									return ContactLinkable.getLinkHash(contact).then(function (getLinkHashFuture) {
										var result = getLinkHashFuture.result;

										contactLinkHashes.push(result.linkHash);
										contactLinkHashCache[contact.getId()] = result.linkHash;
										return true;
									});
								} else {
									contactLinkHashes.push(contactLinkHashCache[contact.getId()]);
									return true;
								}
							});

							return contactLinkHashFuture;
						}
					}, person.getContacts());
				});
				
				return mapFuture;
			}
		}, this.people);
	});
	
	future.then(function () {
		var dummy = future.result;
		
		return contactLinkHashes;
	});
	
	return future;
};
