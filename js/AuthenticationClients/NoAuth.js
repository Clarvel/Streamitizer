import { GenericAuthClient as GenericAuthClient } from "./GenericAuthClient.js"
export class NoAuth extends GenericAuthClient{
	static Type = "noAuth"
	constructor(){
		super()
	}

	async Authenticate(manuallyTriggered=false){
		return {}
	}

	async Refresh(token){return this.Authenticate(false)}
}