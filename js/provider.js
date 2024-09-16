import { Authentication } from "./authentication.js"

export const Provider = authClass => {
    if(!authClass.prototype instanceof Authentication)
        throw Error(authClass.name + " does not implement Authentication class")
    return class extends authClass{
        async GetUIDAndName(auth){throw Error("Not Implemented")}
        async FetchStreams(auth, UID){throw Error("Not Implemented")}
    }
}