import { Authentication } from "../authentication.js"

export class NoAuth extends Authentication{
	async Authenticate(manuallyTriggered=false, request={}){
		return null
	}
}