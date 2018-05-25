/**
 * Turns out even a bunch of newer members don't have created_at fields set.
 * Setting their created at fields from their request_invite fields.
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

async function matchCreatedAtTimes(db: Firestore) {
  const members = (await db.collection("members").get()).docs;
  const operations = (await db
    .collection("operations")
    .where("op_code", "==", "REQUEST_INVITE")
    .get()).docs;

  for (const i in members) {
    const member = members[i];
    const inviteOps = operations.filter(
      op => op.get("creator_uid") === member.id
    );
    if (inviteOps.length !== 1) {
      console.log(
        "member has zero or multiple request invite ops",
        member.id,
        inviteOps.length
      );
      continue;
    }
    const op = inviteOps[0];
    const memberCreatedAt = member.get("created_at");
    const opCreatedAt = op.get("created_at");
    if (memberCreatedAt !== opCreatedAt) {
      if (
        memberCreatedAt === undefined ||
        Math.abs(opCreatedAt.getTime() - memberCreatedAt.getTime()) > 1000
      ) {
        console.log(
          "member",
          member.id,
          member.get("full_name"),
          "created at doesn't match op created at"
        );
        console.log(member.get("created_at"), op.get("created_at"));
        await db
          .collection("members")
          .doc(member.id)
          .update({
            created_at: opCreatedAt
          });
      }
    }
  }
}

async function main() {
  const args = process.argv;
  const db = getDb(args[2], args[3]);
  await matchCreatedAtTimes(db);
}

main().then(() => {
  process.exit(0);
});
