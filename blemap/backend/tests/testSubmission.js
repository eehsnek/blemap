import { createSubmission } from "../repositories/submissionRepository.js";

try {

    const submission = await createSubmission(
        "Brenn Michelle Merin goes to Ateneo de Zamboanga"
    );

    console.log(submission);

}
catch(err){

    console.error(err);

}