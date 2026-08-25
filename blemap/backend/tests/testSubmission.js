import { createSubmission } from "../repositories/submissionRepository.js";

try {

    const submission = await createSubmission(
        "Docker Compose stopped working after updating."
    );

    console.log(submission);

}
catch(err){

    console.error(err);

}