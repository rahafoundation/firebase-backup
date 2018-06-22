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

import { getDb } from "./helpers";
import { request } from "http";

async function standardizeRequestInviteFromField(db: Firestore) {
  const members = (await db.collection("members").get()).docs;

  for (const i in members) {
    const member = members[i];

    const requestInviteFromMemberId = member.get("request_invite_from_uid");
    if (!requestInviteFromMemberId) {
      const BAD_KEY_requestedInviteFromMemberId = member.get(
        "requested_invite_from_uid"
      );
      if (BAD_KEY_requestedInviteFromMemberId) {
        console.log(
          `Renaming field for member with id ${
            member.id
          } from requested_invite_from_uid to request_invite_from_uid`
        );
        await db
          .collection("members")
          .doc(member.id)
          .update({
            request_invite_from_uid: BAD_KEY_requestedInviteFromMemberId,
            requested_invite_from_uid: admin.firestore.FieldValue.delete()
          });
      }
    }
  }
}

async function main() {
  const args = process.argv;
  const db = getDb(args[2], args[3]);
  await standardizeRequestInviteFromField(db);
}

main().then(() => {
  process.exit(0);
});
