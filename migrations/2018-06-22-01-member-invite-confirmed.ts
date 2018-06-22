/**
 * Set the invite_confirmed field on all members.
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

async function setIsInviteConfirmed(db: Firestore) {
  const members = (await db.collection("members").get()).docs;
  const inviteOperations = (await db
    .collection("operations")
    .where("op_code", "==", "REQUEST_INVITE")
    .get()).docs;
  const trustOperations = (await db
    .collection("operations")
    .where("op_code", "==", "TRUST")
    .get()).docs;

  for (const i in members) {
    const member = members[i];

    const inviteOps = inviteOperations.filter(
      op => op.get("creator_uid") === member.id
    );
    if (inviteOps.length < 1) {
      console.log(
        "member has zero request invite ops",
        member.id,
        inviteOps.length
      );
      continue;
    } else if (inviteOps.length > 1) {
      console.log(
        "member has multiple request invite ops",
        member.id,
        inviteOps.length
      );
      continue;
    }

    const requestInviteFromMemberId = member.get("request_invite_from_uid");
    const inviteOp = inviteOps[0];
    const inviteOpData = inviteOp.get("data");
    if (!requestInviteFromMemberId) {
      console.log(`Genesis member ${member.id} invite confirmed.`);
      await db
        .collection("members")
        .doc(member.id)
        .update({
          invite_confirmed: true
        });
    } else if (requestInviteFromMemberId !== inviteOpData.to_uid) {
      console.log(
        `member ${
          member.id
        } request_invite_from is ${requestInviteFromMemberId}. This is different from their request_invite operations to_uid ${
          inviteOpData.to_uid
        }`
      );
      continue;
    }
    const inviteConfirmations = trustOperations.filter(op => {
      const opData = op.get("data");
      return (
        opData.to_uid == member.id &&
        op.get("creator_uid") === requestInviteFromMemberId
      );
    });
    if (inviteConfirmations.length < 1) {
      console.log(`Member ${member.id} is not a confirmed member`);
      await db
        .collection("members")
        .doc(member.id)
        .update({
          invite_confirmed: false
        });
    } else {
      console.log(`Member ${member.id} is confirmed.`);
      await db
        .collection("members")
        .doc(member.id)
        .update({
          invite_confirmed: true
        });
    }
  }
}

async function main() {
  const args = process.argv;
  const db = getDb(args[2], args[3]);
  await setIsInviteConfirmed(db);
}

main().then(() => {
  process.exit(0);
});
