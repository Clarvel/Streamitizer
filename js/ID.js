import { Browser } from "./browser.js"
import { Settings } from "./settings.js"

const INSTANCE_ID_KEY ="_UniqueID"

export class ID{
	static BackgroundUpdaterId = "BackgroundUpdater"
	static AuthenticationKey = "AUTHENTICATION"
	
	// only call on install!
	static Init(){
		let getters = Object.entries(Object.getOwnPropertyDescriptors(ID.prototype)).filter(([k,v])=>v.get!=null).map((k,v)=>k)
		let settings = new Settings("ID", getters)
		getters.forEach(getter => {
			settings.Set(getter, window.crypto.randomUUID())
		});
	}

	get BackgroundUpdaterId(){}
	get AuthenticationKey(){}


	/**
	 * @returns {Promise<string>}
	 */
	static async GetInstanceID(){
		let id = await Browser.GetStorage(INSTANCE_ID_KEY, false)?.[INSTANCE_ID_KEY]
		if(id == null){
			id = Browser.randomUUID()
			await Browser.SetStorage({[INSTANCE_ID_KEY]:id})
		}
		return id
	}
}