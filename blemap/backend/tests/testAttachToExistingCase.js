import { createNewCase, attachToExistingCase } from "../services/caseService.js";
import { getCaseById } from "../repositories/caseRepository.js";

const initialSubmission = "A small business was sued because a supplier contract was unpaid.";
const additionalSubmission = "The supplier escalated to small claims court last week.";

// 1. Seed a case
const created = await createNewCase(initialSubmission);

console.log("Created case ID:", created.id);
console.log("Original summary:", created.summary);

// 2. Attach
const updated = await attachToExistingCase(
    created.id,
    additionalSubmission
);

console.log("Updated summary:", updated.summary);
console.log("Updated aggregated_at:", updated.aggregated_at);

// 3. Re-fetch from DB to confirm persistence
const refetched = await getCaseById(created.id);

console.log("Refetched summary:", refetched.summary);