import { Browser } from "../browser.js"
import { Authentication } from "../authentication.js"
import { IsNullOrWhitespace } from "../utils.js"

export class PersonalTokenAuth extends Authentication{
    async Authenticate(manuallyTriggered=false, request={}){
        const bearer = await Browser.SendMessage({type:"prompt",prompt:"PiczelrequestBearerToken"})
        if(IsNullOrWhitespace(bearer))
            throw Error(`Bearer Token not provided`)
        return bearer
    }
}