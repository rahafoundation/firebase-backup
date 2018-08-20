/**
 * This operation handles the transition from a RequestInvite + Trust flow to CreateMember and Verify.
 *
 * All RequestInvite operations are transformed into CreateMember operations. This involves
 * updating their op_code and updating the field called data.to_uid to data.torequest_invite_from_member_id.
 *
 * A Trust operation from the inviting member to the new invited member previously indicated that the
 * new member was legitimate. Now, an explicit Verify operation is required. For every Trust operation
 * between an inviting member and the person they invited, we create a new Verify operation. The Verify
 * operation points to the new member's invite video as the Verification video, since all members created
 * via the RequestInvite flow joined with joint invite videos where both the inviter and the invitee state
 * their name.
 *
 * This migration is idempotent allowing it to be run again if new members go through the RequestInvite flow
 * (as could continue to happen until the web-based flow is shut down).
 *
 * Note that this migration also modifies the GENESIS RequestInvite and Trust operations. These are the
 * operations that led to the spontaneous creation and trusting of the GENESIS members (Mark and family).
 *
 * It adds the "GENESIS" special value to the request_invite_from_member_id field of the new GENESIS CreateMember
 * operations - previously this field would have been null. Similarly, the Verify operation for these GENESIS
 * members will have the creator_uid set to "GENESIS" instead of the previous value of null. The GENESIS
 * Trust operations will be deleted, as they no longer have any purpose. THIS MEANS THAT THE REST OF THE
 * CODEBASE MUST BE UPDATED WITH THE IDS OF THE NEW GENESIS VERIFY OPERATIONS AFTER THIS MIGRATION HAS BEEN RUN.
 */

import * as admin from "firebase-admin";
import { Firestore } from "@google-cloud/firestore";

import {
  Operation,
  OperationType,
  VerifyOperation
} from "@raha/api-shared/dist/models/Operation";
import { Omit } from "@raha/api-shared/dist/helpers/Omit";

import { getDb } from "./helpers";

export const GENESIS_REQUEST_INVITE_OPS = [
  "InuYAjMISl6operovXIR",
  "SKI5CxMXWd4qjJm1zm1y",
  "SUswrxogVQ6S0rH8O2h7",
  "Y8FiyjOLs9O8AZNGzhwQ"
];
export const ORIGINAL_GENESIS_TRUST_OPS = [
  "va9A8nQ4C4ZiAsJG2nLt",
  "CmVDdktn3c3Uo5pP4rV6",
  "uAFLhBjYtrpTXOZkJ6BD",
  "y5EKzzihWm8RlDCcfv6d"
];

const GENESIS = "GENESIS";

function getInviteVideoUrlForMemberId(memberId: string) {
  return `https://storage.googleapis.com/raha-video/${memberId}/invite.mp4`;
}

async function migrateToCreateMemberAndVerify(db: Firestore, dryRun: boolean) {
  const operationsCollection = db.collection("operations");
  const operations = (await operationsCollection.orderBy("created_at").get())
    .docs;

  const invitedBy: { [memberId: string]: string } = {};

  let createdOperations = 0;
  let updatedOperations = 0;

  const newGenesisVerifyOperations: string[] = [];

  for (const i in operations) {
    const operation = operations[i];
    const operationData = operation.data() as Operation;

    if (operationData.op_code === OperationType.CREATE_MEMBER) {
      if (operationData.data.request_invite_from_member_id) {
        invitedBy[operationData.creator_uid] =
          operationData.data.request_invite_from_member_id;
      }
    }

    // Skip non-request-invite and non-trust operations
    if (
      operationData.op_code !== OperationType.REQUEST_INVITE &&
      operationData.op_code !== OperationType.TRUST
    ) {
      continue;
    }

    if (operationData.op_code === OperationType.REQUEST_INVITE) {
      const newMemberMemberId = operationData.creator_uid;
      const operationToUid = operationData.data.to_uid;

      const inviterMemberId =
        operationToUid === null &&
        GENESIS_REQUEST_INVITE_OPS.indexOf(operation.id) >= 0
          ? GENESIS
          : operationToUid;

      if (invitedBy[newMemberMemberId] !== undefined) {
        console.error("Member has already requested an invite!");
      } else {
        invitedBy[newMemberMemberId] = inviterMemberId;
      }

      const updatesToOperation = {
        op_code: OperationType.CREATE_MEMBER,
        "data.request_invite_from_member_id": inviterMemberId,
        "data.to_uid": admin.firestore.FieldValue.delete()
      };
      console.log("=============================");
      console.log("Updating operation", operation.id);
      console.log("Operation was", operationData);
      console.log("Update", updatesToOperation);
      console.log("=============================");
      if (!dryRun) {
        await operation.ref.update(updatesToOperation);
        ++updatedOperations;
      }
    }
    if (operationData.op_code === OperationType.TRUST) {
      const opCreatorUid = operationData.creator_uid;

      const trusterMemberId =
        opCreatorUid === null &&
        ORIGINAL_GENESIS_TRUST_OPS.indexOf(operation.id) >= 0
          ? GENESIS
          : opCreatorUid;
      const trustedMemberId = operationData.data.to_uid;

      if (invitedBy[trustedMemberId] === trusterMemberId) {
        // Check if this is a request-invite confirming Trust operation
        // Check if the requisite "Verify" operation already exists.
        // Allows this migration to be idempotent.
        if (
          !(await operationsCollection
            .where("op_code", "==", OperationType.VERIFY)
            .where("creator_uid", "==", trusterMemberId)
            .where("data.to_uid", "==", trustedMemberId)
            .get()).empty
        ) {
          continue;
        }

        const newVerifyOperation: Omit<VerifyOperation, "id"> = {
          op_code: OperationType.VERIFY,
          creator_uid: trusterMemberId,
          created_at: new Date(operationData.created_at),
          data: {
            to_uid: trustedMemberId,
            video_url: getInviteVideoUrlForMemberId(trustedMemberId)
          }
        };

        console.log("=============================");
        console.log(
          "Creating a new verify operation for trust operation with id",
          operation.id
        );
        console.log("Trust operation was", operationData);
        console.log("Verify operation is", newVerifyOperation);
        console.log("=============================");
        if (!dryRun) {
          const newVerifyOp = await operationsCollection.add(
            newVerifyOperation
          );
          if (ORIGINAL_GENESIS_TRUST_OPS.indexOf(operation.id) >= 0) {
            await operation.ref.delete();
            newGenesisVerifyOperations.push(newVerifyOp.id);
          }
          ++createdOperations;
        }
      }
    }
  }
  console.log(`Created ${createdOperations} operations.`);
  console.log(`Updated ${updatedOperations} operations.`);
  if (newGenesisVerifyOperations.length > 0) {
    console.log("!!!!!! IMPORTANT !!!!!!!");
    console.log(
      "New GENESIS Verify operations were created, and the original GENESIS Trust operations were deleted."
    );
    console.log(
      "The Ids of the new GENESIS Verify operations are",
      newGenesisVerifyOperations
    );
    console.log(
      "Please update anywhere in the codebase that expects these operation ids."
    );
  }
}

async function main() {
  console.log(
    "Running migration `2018-08-20-00-migrate-to-create-member-and-verify`."
  );
  console.log(
    "This migration converts all RequestInvite operations into CreateMember " +
      "operations and adds a new Verify operation for invite-confirming Trust operations."
  );
  console.log(
    "Arguments: path_to_credentials_file project_name [dryRun:boolean]"
  );
  const args = process.argv;
  if (args.length < 4) {
    console.warn(
      "Invalid number of arguments. See usage information above. Exiting."
    );
    return;
  }
  const db = getDb(args[2], args[3]);
  let isDryRun = args.length > 4 ? args[4] !== "false" : true;
  await migrateToCreateMemberAndVerify(db, isDryRun);
}

main().then(() => {
  process.exit(0);
});
