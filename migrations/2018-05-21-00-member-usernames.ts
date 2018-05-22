/**
 * This is an example script for how to migrate firestore data, in this case
 * how we did the migration from member usernames with $ to using .
 */

import * as path from "path";
import * as admin from "firebase-admin";

async function migrateMemberUsernamesDollarToDot(
  pathToFbKey: string,
  projectId: string
): Promise<void> {
  const firebaseKey = require(path.resolve(
    path.join(process.cwd(), pathToFbKey)
  ));
  if (firebaseKey.project_id !== projectId) {
    throw Error(
      `Gave projectId ${projectId} but path to firebase key credentials was for ${
        firebaseKey.project_id
      }`
    );
  }
  const app = admin.initializeApp({
    credential: admin.credential.cert(firebaseKey),
    databaseURL: `https://${firebaseKey.project_id}.firebaseio.com`
  });
  const db = app.firestore();
  const GENESIS_UIDS = new Set([
    "mPTv77Bs8iVdPXUzF7bYv2zZ0qI2",
    "sj7oal4vnLUALUhE5tb6xazgmuI3",
    "dgSRh23dMcOXQeoA0vUyBE4cVAD2",
    "Cj4TcLjooRe2D4WfIZyPAzdlUT52"
  ]);
  const numDocs = await db.runTransaction(async tx => {
    const membersRef = db.collection("members");
    const opsRef = db.collection("operations");
    const members = await membersRef.get();
    const operations = await opsRef.get();
    const memberUidToMid = new Map();
    members.docs.forEach(d => {
      let mid = d.get("mid");
      if (!mid) {
        throw Error(`Found an mid with value ${mid} for member doc ${mid}`);
      }
      memberUidToMid.set(d.id, mid);
      const request_invite_from_mid = null;
      tx.update(membersRef.doc(d.id), {
        mid: admin.firestore.FieldValue.delete(),
        request_invite_from_mid: admin.firestore.FieldValue.delete(),
        username: mid.replace("$", ".")
      });
    });
    operations.docs.forEach(d => {
      const creatorMid = d.get("creator_mid");
      const creatorUid = d.get("creator_uid");
      const toMid = d.get("data.to_mid");
      const toUid = d.get("data.to_uid");
      if (!creatorMid || !toMid) {
        if (
          creatorUid === null &&
          GENESIS_UIDS.has(toUid) &&
          d.get("op_code") === "TRUST"
        ) {
          // okay
        } else if (
          GENESIS_UIDS.has(creatorUid) &&
          toUid === null &&
          d.get("op_code") === "REQUEST_INVITE"
        ) {
          // okay
        } else {
          console.error(
            `Unexpected document: ${JSON.stringify(d.data(), null, 2)}`
          );
        }
      } else if (
        memberUidToMid.get(creatorUid) !== creatorMid ||
        memberUidToMid.get(toUid) !== toMid
      ) {
        console.error(
          `The op ${
            d.id
          } has inconsistent mid and uid mappings, expect ${memberUidToMid.get(
            creatorUid
          )} == ${creatorMid} and ${memberUidToMid.get(toUid)} == ${toMid}`
        );
      }
      const updates: any = {
        creator_mid: admin.firestore.FieldValue.delete(),
        "data.to_mid": admin.firestore.FieldValue.delete()
      };
      if (d.get("op_code") === "REQUEST_INVITE") {
        updates["data.username"] = creatorMid.replace("$", ".");
      }
      tx.update(opsRef.doc(d.id), updates);
    });
    return members.docs.length + operations.docs.length;
  });
  console.log(`Successfully updates ${numDocs} docs`);
  process.exit();
}

async function main() {
  const args = process.argv;

  if (args.length !== 4) {
    console.error(
      "Usage is npx ts-node 2018-05-21-member-usernames.ts path-to-fb-key fb-url. You provided:",
      args
    );
    process.exit(2);
  }
  try {
    await migrateMemberUsernamesDollarToDot(args[2], args[3]);
    console.info("Migrating member usernames succeeded.");
    process.exit();
  } catch (err) {
    console.error("Migrating member usernames failed.", err);
    process.exit(1);
  }
}

main();
