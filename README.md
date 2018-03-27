# firebase-backup

A simple backup tool for operations and members in firestore. Currently specific to the Raha.io schema. We use this to create json backups of prod db snippets, then push them all into a test db (which currently requires relaxing test db firetore.rules). You can also then modify the test uid used to make authentication work while developing.

## Install

Tested on node v.9.6.1+, npm 5.6.0+, but probably works for earlier versions. Uses babel for es6 support.

```
npm install
```

## Commands

### Create a backup of the prod Firestore DB.

```
npm run backup-prod
```

### Restore a backup to the test Firestore DB.

```
npm run restore-test
```

### Edit your personal test uid.

Easy way: log in to test, then create an issue in this repo with the email you used to log in
and your public member id, we can edit it for you.

Or, if you have sufficient permissions (or have created your own firestore db and set [`firebase.test.config.json`](firebase.test.config.json) to point there), can look up your new authentication uid used in the
test db so that you can log in while developing locally. Then run:

```
npm run edit-test-uid memberPrefix memberPublicPin NEW_UID
```
