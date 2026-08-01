import { getAllCases } from "../repositories/caseRepository.js";

try {

    const cases = await getAllCases();

    console.log("Embedding:");
    console.log(cases[0].embedding);

    console.log("Type:");
    console.log(typeof cases[0].embedding);

    console.log("Is Array?");
    console.log(Array.isArray(cases[0].embedding));

}
catch(err){

    console.error(err);

}