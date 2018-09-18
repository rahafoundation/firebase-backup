import * as readline from "readline";
import * as fs from "fs";
import * as util from "util";
import { Query, CollectionReference } from "@google-cloud/firestore";
import { getDb } from "./helpers";

const readFileAsync = util.promisify(fs.readFile);
const MAX_ENTITIES_PER_CALL = 500;

function deserialize(serialized: string) {
  return eval(`(${serialized})`);
}

async function deleteAllDocsInCollection(
  collection: CollectionReference
): Promise<number> {
  let curCollectionView: Query = collection;
  let numDeleted = 0;
  while (true) {
    const snapshot = await curCollectionView.get();
    const fetchSize = snapshot.docs.length;
    if (fetchSize === 0) break;

    const last = snapshot.docs[snapshot.docs.length - 1];

    let batch = collection.firestore.batch();
    for (let i = 0; i < fetchSize; i++) {
      if (i > 0 && i % MAX_ENTITIES_PER_CALL === 0) {
        await batch.commit();
        batch = collection.firestore.batch();
      }
      batch.delete(snapshot.docs[i].ref);
    }
    await batch.commit();
    numDeleted += fetchSize;
    curCollectionView = collection.startAfter(last);
  }
  return numDeleted;
}

async function restoreDatabase(pathToFbKey: string): Promise<void> {
  const testConfig = require("./firebase.test.config.json");
  const db = getDb(pathToFbKey, testConfig.projectId);

  const collectionsToRestore = {
    operations: db.collection("operations"),
    members: db.collection("members")
  };

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

const rl = readline.createInterface({
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

async function main() {
  const args = process.argv;

  if (args.length !== 3) {
    console.error(
      "Usage is yarn run restore-test path-to-fb-key. You provided:",
      args
    );
    process.exit(2);
  }

  const confirmed = await promptRestoreDatabase();
  if (!confirmed) {
    console.error("User did not accept; aborting.");
    process.exit(2);
  }

  try {
    await restoreDatabase(args[2]);
    console.info("Restored database.");
    process.exit(0);
  } catch (err) {
    console.error("Migrating member usernames failed.", err);
    process.exit(1);
  }
}

main();
