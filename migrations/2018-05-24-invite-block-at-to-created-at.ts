/**
 * Set/reset the created_at field on member objects and
 * operations that were created from the original blockchain blocks.
 *
 * The created_at field will be equal to the block_at timestamp plus
 * 1 * op_seq (the sequence number of the operation
 * within its block) seconds.
 *
 * There can also be multiple operations for a given op_seq (a relic
 * of the original create_member operations being split into REQUEST_INVITE
 * and TRUST). We sort operations for a given block_seq,op_seq such that
 * the REQUEST_INVITE falls first and then increment the created_at
 * by 1 millisecond for each subsequent operation.
 *
 * This allows us to maintain a strict ordering by created_at
 * of operations.
 *
 * This migration is necessary since the total amount of Raha
 * mintable is initially calculated from the created_at timestamp
 * on the member object. (Note: after the first mint it is
 * calculated from the last_minted timestamp.)
 */

import * as path from "path";

import * as admin from "firebase-admin";
import {
  Firestore,
  QueryDocumentSnapshot,
  DocumentSnapshot
} from "@google-cloud/firestore";

function getDb(pathToFbKey: string, projectId: string) {
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
  return app.firestore();
}

async function setMemberCreatedAt(db: Firestore) {
  const members = (await db.collection("members").get()).docs;
  const blockMembers = members.filter(member =>
    member.get("request_invite_block_at")
  );
  blockMembers.sort(
    (a, b) =>
      a.get("request_invite_block_seq") - b.get("request_invite_block_seq") ||
      a.get("request_invite_op_seq") - b.get("request_invite_op_seq")
  );
  blockMembers.map(member => {
    const blockSeq = member.get("request_invite_block_seq");
    const opSeq = member.get("request_invite_op_seq");
    const blockAt = member.get("request_invite_block_at");
    const newCreatedAt = new Date(blockAt.getTime() + 1000 * opSeq);
    console.log(
      blockSeq,
      opSeq,
      blockAt,
      "setting created_at to:",
      newCreatedAt,
      member.get("full_name")
    );
  });
  // TODO update the member
}

async function updateOperationCreatedAt(db: Firestore) {
  const operations = (await db.collection("operations").get()).docs;
  const blockOps = operations.filter(operation => operation.get("block_at"));
  blockOps.sort((a, b) => {
    const aBlockSeq = a.get("block_seq");
    const bBlockSeq = b.get("block_seq");
    if (aBlockSeq < bBlockSeq) return -1;
    if (aBlockSeq > bBlockSeq) return 1;

    const aOpSeq = a.get("op_seq");
    const bOpSeq = b.get("op_seq");
    if (aOpSeq < bOpSeq) return -1;
    if (aOpSeq > bOpSeq) return 1;

    const aOpCode = a.get("op_code");
    const bOpCode = b.get("op_code");
    if (aOpCode === "REQUEST_INVITE" && bOpCode === "TRUST") return -1;
    if (aOpCode === "TRUST" && bOpCode === "REQUEST_INVITE") return 1;

    return 0;
  });

  // Track the number of operations for a given block_seq, op_seq
  let blockCounter = 0;
  let opCounter = 0;
  let internalCounter = 0;
  blockOps.map(op => {
    const blockSeq = op.get("block_seq");
    const opSeq = op.get("op_seq");
    const blockAt = op.get("block_at");

    if (blockSeq !== blockCounter || opSeq !== opCounter) {
      blockCounter = blockSeq;
      opCounter = opSeq;
      internalCounter = 0;
    }
    const newCreatedAt = new Date(
      blockAt.getTime() + 1000 * opSeq + 1 * internalCounter
    );
    internalCounter++;

    console.log(
      blockSeq,
      opSeq,
      blockAt,
      "updating created_at to:",
      newCreatedAt,
      op.get("op_code")
    );
    // TODO update the operation
  });
}

async function addCreatedAtField(db: Firestore) {
  await setMemberCreatedAt(db);
  await updateOperationCreatedAt(db);
}

async function main() {
  const args = process.argv;
  const db = getDb(args[2], args[3]);
  await addCreatedAtField(db);
}

main().then(() => {
  process.exit(0);
});
