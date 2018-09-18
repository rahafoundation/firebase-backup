/**
 * Some members had an inconsistently named request_invite_from_uid field.
 * The field was instead named requested_invite_from_uid. This standardizes
 * the name on all members to the new request_invite_from_member_id.
 */

import * as admin from "firebase-admin";
import { Firestore } from "@google-cloud/firestore";

import { getDb } from "../helpers";

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
          } from requested_invite_from_uid to request_invite_from_member_id`
        );
        await db
          .collection("members")
          .doc(member.id)
          .update({
            request_invite_from_member_id: BAD_KEY_requestedInviteFromMemberId,
            requested_invite_from_uid: admin.firestore.FieldValue.delete()
          });
      }
    } else {
      console.log(
        `Renaming field for member with id ${
          member.id
        } from request_invite_from_uid to request_invite_from_member_id`
      );
      await db
        .collection("members")
        .doc(member.id)
        .update({
          request_invite_from_member_id: requestInviteFromMemberId,
          request_invite_from_uid: admin.firestore.FieldValue.delete()
        });
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
