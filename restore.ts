import * as readline from "readline";
import * as firebase from "firebase";
import * as fs from "fs";
import * as util from "util";

const readFileAsync = util.promisify(fs.readFile);

/* =======
 * Helpers
 * =======
 */

function deserialize(serialized: string) {
  return eval(`(${serialized})`);
}

async function deleteAllDocsInCollection(
  collection: firebase.firestore.CollectionReference
): Promise<number> {
  let curCollectionView: firebase.firestore.Query = collection;
  let numDeleted = 0;
  while (true) {
    const snapshot = await curCollectionView.get();
    const fetchSize = snapshot.docs.length;
    if (fetchSize === 0) break;

    const last = snapshot.docs[snapshot.docs.length - 1];

    const batch = collection.firestore.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    numDeleted += fetchSize;
    curCollectionView = collection.startAfter(last);
  }
  return numDeleted;
}

async function restoreDatabase(): Promise<void> {
  firebase.initializeApp(require("./firebase.test.config.json"));
  const auth = firebase.auth();
  const db = firebase.firestore();

  const collectionsToRestore = {
    operations: db.collection("operations"),
    members: db.collection("members")
  };

  let numCollectionsRestored = 0;
  const numCollectionsToRestore = Object.keys(collectionsToRestore).length;

  await Promise.all(
    Object.entries(collectionsToRestore).map(
      async ([collectionName, collection]) => {
        const backupFilename = `./backup.${collectionName}.serializedJs`;
        const backupText = await readFileAsync(backupFilename, "utf8");
        const backupData = backupText
          .split("\n")
          .map(object => deserialize(object));

        const numEntriesToRestore = backupData.length;

        console.log(`Deleting docs from collection ${collectionName}`);
        const numDeleted = await deleteAllDocsInCollection(collection);
        console.log(
          `Deleted ${numDeleted} docs from collection ${collectionName}`
        );

        console.log(`Restoring collection ${collectionName}`);
        await Promise.all(
          backupData.map(entryToRestore => {
            const { id, data } = entryToRestore;
            return collection.doc(id).set(data);
          })
        );

        console.info(
          `Restored ${numEntriesToRestore} entries into collection ${collectionName}`
        );
      }
    )
  );
}

/* ==================
 * User input helpers
 * ==================
 */

let rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function prompt(question: string): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    rl.question(question, answer => resolve(answer === "y"));
  });
}

async function promptRestoreDatabase(): Promise<boolean> {
  rl.write(
    "This will destroy all data in the test database and restore it from your local backup of the prod db.\n"
  );
  if (
    !(await prompt(
      "Do you have a local backup of the prod db? (If not, run `npm run backup`) (y/n) "
    ))
  ) {
    return false;
  }

  return await prompt(
    "Are you sure you want to delete and restore the test database? (y/n) "
  );
}

/* ======
 * Script
 * ======
 */

promptRestoreDatabase()
  .then(confirmed => {
    if (!confirmed) {
      console.error("User did not accept; aborting.");
      process.exit(2);
    }

    return restoreDatabase();
  })
  .then(() => {
    console.log("Restored database.");
    process.exit(0);
  })
  .catch(err => {
    console.error("Failed to restore database.", err);
    process.exit(1);
  });
