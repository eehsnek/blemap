import { validateInput } from "../utils/validation.js";

const tests = [

    null,

    "",

    "      ",

    123,

    "short",

    "Docker compose stopped working after updating."

];

for (const test of tests) {

    try {

        console.log(validateInput(test));

    }

    catch (err) {

        console.log(err.message);

    }

}