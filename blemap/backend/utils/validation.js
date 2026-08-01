export function validateInput(text) {

    // Must exist
    if (text === undefined || text === null) {
        throw new Error("Description is required.");
    }

    // Must be a string
    if (typeof text !== "string") {
        throw new Error("Description must be text.");
    }

    // Remove leading/trailing spaces
    const cleaned = text.trim();

    // Cannot be empty
    if (cleaned.length === 0) {
        throw new Error("Description cannot be empty.");
    }

    // Too short
    if (cleaned.length < 15) {
        throw new Error("Description is too short.");
    }

    // Too long
    if (cleaned.length > 3000) {
        throw new Error("Description is too long.");
    }

    return cleaned;
}