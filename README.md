# raha.backup

a simple backup tool for models in firestore.

## Install

Tested on node v.9.6.1+, npm 5.6.0+, but probably works for earlier versions. Uses babel for es6 support.

```
npm install
```

## Create a backup of the prod Firestore DB.

```
npm run backup
```

## Restore a backup to the test Firestore DB.

This currently breaks because of Firestore Rules. You can manually and temporarily
adjust the rules to allow these objects to be created (and delete the existing objects)
or... we could figure out a better permissions solution.

```
npm run restoreTest
```