import { StreamClientController } from "../streamingService.js"
import { Browser } from "../browser.js"
import { LoadI18nTextToElem, GetI18nText, SetElemValue, GetElemValue, GetSelectOption } from "../utils.js"
import { Settings } from "../settings.js"
import { ModalHTMLController } from "./ModalHTMLController.js"

const THEME = "theme"

const ACCOUNTS_CONTAINER = document.getElementById("accountsContainer")
const ACCOUNTS_ADD_BUTTON = document.getElementById("accountsAdd")
const ACCOUNTS_RESET_BUTTON = document.getElementById("accountsReset")
const OPTIONS_RESET_BUTTON = document.getElementById("optionsReset")
const CLEAR_ALL_DATA_BUTTON = document.getElementById("clearAllData")

const ACCOUNT_TEMPLATE = document.getElementById("accountTemplate").content
const BOOL_TEMPLATE = document.getElementById("boolTemplate").content
const SELECT_TEMPLATE = document.getElementById("selectTemplate").content
const RANGE_TEMPLATE = document.getElementById("rangeTemplate").content
const ACCOUNT_EDIT_TEMPLATE = document.getElementById("accountEditTemplate").content
const ERROR_TEMPLATE = document.getElementById("errorTemplate").content
//const ACTIVE_STREAMS_KEY = "ActiveStreams"


/**
 * @type {Settings}
 */
let SETTINGS = null
/**
 * @type {StreamClientController}
 */
let ACCOUNTS_CONTROLLER = null

let MODAL_CONTROLLER = new ModalHTMLController("modal", "modalTitle", "modalBody", "modalAccept", "modalClose", "om_error", "ob_modalOK")

/**
 * @param {Event} evt 
 * @param {Function} tryFunc 
 */
async function OnAccountButton(evt, tryFunc){
	const elem = evt.target
	elem.setAttribute("disabled", "")
	try{
		await tryFunc(elem.closest(".list-group-item").id)
	}catch(e){
		console.warn(e)
		MODAL_CONTROLLER.DisplayErrorModal(e.message)
	}
	elem.removeAttribute("disabled")
}

/**
 * Handles saving changes made to HTML inputs
 * @param {HTMLInputElement | HTMLSelectElement} inputElem 
 * @param {Settings} settings 
 */
async function OnManualInputChange(inputElem, settings){
	inputElem.setAttribute("disabled", "")
	inputElem.setAttribute("indeterminate", "")

	try{
		const value = await settings.Get(inputElem.id)
		try{
			await settings.Set(inputElem.id, GetElemValue(inputElem))
			return // handle removing the attribute when we get the onChanged confirmation
		}catch(e){
			console.warn(e);
			SetElemValue(inputElem, value)
			MODAL_CONTROLLER.DisplayErrorModal(e.message)
		}
	}catch(ex){
		console.warn(ex)
	}

	inputElem.removeAttribute("disabled")
	inputElem.removeAttribute("indeterminate")
}

function ImportTemplate(template, selector="input, select"){
	let templateElem = document.importNode(template, true)
	return [templateElem, templateElem.querySelector(selector)]
}

function LoadOptionsContainer(container, keys, getConfigByKeyFunc, getValueByKeyFunc, onInputChange){
	//console.log(container, keys, getConfigByKeyFunc, getValueByKeyFunc)

	container.textContent = "" // clear out the container
	let _GetTemplateAndSetupFunc = (config)=>{
		if("options" in config)
			return [SELECT_TEMPLATE, (input, config, name)=>{
				for(const option of config["options"]){
					let elem = document.createElement("option")
					LoadI18nTextToElem(elem, "oo_" + name + option.toString()) // dont care when this completes, using .toString, because name could be a number
					elem.value = option
					input.appendChild(elem)
				}
			}]
		if("min" in config && "max" in config)
			return [RANGE_TEMPLATE, (input, config, name)=>{
				let _onRangeInput = (event)=>{event.target.parentNode.querySelector("output").textContent = `[${event.target.value}]`}

				input.addEventListener("input", _onRangeInput)
				input.min = config["min"]
				input.max = config["max"]			
				_onRangeInput({target:input})
			}]
		if(typeof config["value"] === 'boolean')
			return [BOOL_TEMPLATE, ()=>{}]
		throw Error(`Unknown Setting Type: ${config}`)
	}

	return keys.map(async key => {
		try{
			let config = await getConfigByKeyFunc(key)
			if(config == null)
				return
			//console.log(key, config)
			let [template, setupFunc] = _GetTemplateAndSetupFunc(config)
			let [elem, input] = ImportTemplate(template)
			setupFunc(input, config, key)
		
			let label = elem.querySelector("label")
			LoadI18nTextToElem(label, "ol_"+key) // don't care when this completes
		
			input.id = key
			label.htmlFor = key
		
			input.addEventListener('change', onInputChange);
		
			SetElemValue(input, await getValueByKeyFunc(key))
			
			if(config["disabled"])
				elem.firstElementChild.classList.add("disabled")
			else
				input.removeAttribute("disabled")
			input.removeAttribute("indeterminate")
			//console.log(elem)
			container.appendChild(elem) // do this last because it leaves an empty docfrag
		}catch(e){
			console.warn("Failed to create element for setting: " + key, e)
		}
	})
}

async function OnDeleteAccountButton(id){
	const client = await ACCOUNTS_CONTROLLER.GetClient(id)
	const username = await client.GetUsername()
	const typeText = await GetI18nText("ol_"+client.Type)
	
	MODAL_CONTROLLER.DisplayModal({
		title:GetI18nText("oh_accountRemove", [typeText]), 
		primaryButton:"ob_accountRemove", 
		secondaryButton:"ob_modalCancel", 
		contents:username == null ? GetI18nText("om_deleteDisconnectedAccountModal", [typeText]) : GetI18nText("om_deleteAccountModal", [typeText, username]), 
		callback:(e, ok)=>{if(ok)return ACCOUNTS_CONTROLLER.Delete(id)}
	})
}

async function OnFixAccountButton(id){
	const client = await ACCOUNTS_CONTROLLER.GetClient(id)
	await client.GetAuthentication(true)
	await client.GetUsername(true)
	//TODO update extension icon count!
}

async function OnEditAccountButton(id, isNew=false){
	const account = await ACCOUNTS_CONTROLLER.GetClient(id)
	const clientType = account.Type
	//console.log(account)

	account.OnUpdate((changes)=>{
		console.log("Account Update:", changes)
		for(const key in changes){
			const elem = document.getElementById(key)
			if(elem == null){
				console.warn(`Could not find element with ID ${key} to update`)
				continue
			}
			SetElemValue(elem, changes[key])
			elem.removeAttribute("disabled")
			elem.removeAttribute("indeterminate")
		}
	})

	MODAL_CONTROLLER.DisplayModal({
		title:GetI18nText(isNew ? "oh_accountsAdd" : "oh_accountsEdit", [await GetI18nText("ol_"+clientType)]),
		contents:(async ()=>{
			const elem = document.importNode(ACCOUNT_EDIT_TEMPLATE, true)

			const config = (await ACCOUNTS_CONTROLLER.GetClientTypeConfig(clientType))?.["Options"]
			if(config != null)
				LoadOptionsContainer(elem.firstElementChild, Object.keys(config), k=>config[k], async k=>await account.Get(k), e=>OnManualInputChange(e.target, account))
			if(isNew)
				LoadI18nTextToElem(elem.querySelector(".description"), "ol_" + account.AuthType)
			return elem
		})(),
		primaryButton:isNew ? "ob_accountsCreate" : "ob_modalClose",
		secondaryButton:isNew ? "ob_modalCancel" : undefined,
		callback:isNew ? async (e, accepted)=>{
			if(accepted){
				const newStreams = await ACCOUNTS_CONTROLLER.Activate(id)
				console.log(newStreams)
				if(await SETTINGS.Get("notifications")){
				}
			}else{
				await ACCOUNTS_CONTROLLER.Delete(id)
			}
		} : undefined
	})
}

/**
 * @param {GenericStreamClient} client 
 */
async function CreateClientElem(client){
	const type = client.Type
	const typeText = await GetI18nText("ol_"+type)

	const elem = document.importNode(ACCOUNT_TEMPLATE, true)
	//console.log(elem)
	elem.querySelector(".list-group-item").id = client.ID
	elem.querySelector("img.accountIcon").src = `../icons/${type}.png`
	elem.querySelector("a").href = await client.GetSite()
	const username = await client.GetUsername()
	if(username != null)
		LoadI18nTextToElem(elem.querySelector("label"), "oh_accountName", [typeText, username])
	else
		LoadI18nTextToElem(elem.querySelector("label"), "oh_accountNameMissing", [typeText])

	const primaryButton = elem.querySelector(".btn-primary")
	LoadI18nTextToElem(primaryButton, "ob_accountEdit")
	primaryButton.addEventListener("click", async evt=>await OnAccountButton(evt, OnEditAccountButton))

	const fixButton = elem.querySelector(".btn-secondary")
	LoadI18nTextToElem(fixButton, "ob_accountFix")
	fixButton.addEventListener("click", async evt=>await OnAccountButton(evt, OnFixAccountButton))
	//if(await client.GetAuthentication() != null)
	//	fixButton.style.display = "none"

	const removeButton = elem.querySelector(".btn-warning")
	LoadI18nTextToElem(removeButton, "ob_accountRemove")
	removeButton.addEventListener("click", async (evt)=>await OnAccountButton(evt, OnDeleteAccountButton))

	elem.querySelector(".errors").append(...Object.entries(await client.GetErrorState() ?? {}).map(([message, count])=>{
		const el = document.importNode(ERROR_TEMPLATE, true)
		el.querySelector(".desc").textContent = message
		el.querySelector(".count").textContent = count
		el.querySelector(".remove").addEventListener("click", async (e)=>{
			e.stopPropagation(); 
			await client.RemoveErrorState(message)
			e.target.parentNode.remove()
		})
		return el
	}))
	return elem
}

async function LoadClientsContainer(){
	return (await ACCOUNTS_CONTROLLER.GetClientIDs()).map(async (id) => {
		ACCOUNTS_CONTAINER.prepend(await CreateClientElem(await ACCOUNTS_CONTROLLER.GetClient(id)))
	})
}

async function OnAccountAddButtonSelected(evt){
	const type = evt.target.value // get option type value and reset dropdown
	ACCOUNTS_ADD_BUTTON.selectedIndex = GetSelectOption(ACCOUNTS_ADD_BUTTON, o=>o.hasAttribute("hidden")).index
	try{
		return await OnEditAccountButton(await ACCOUNTS_CONTROLLER.CreateClientID(type), true)
	}catch(e){
		console.warn(e);
		MODAL_CONTROLLER.DisplayErrorModal(e.message)
	}
}

function OnSettingsUpdate(changes){
	console.log("Settings Update:", changes)
	for(const key in changes){
		const elem = document.getElementById(key)
		if(elem == null){
			console.warn(`Could not find element with ID ${key} to update`)
			continue
		}
		SetElemValue(elem, changes[key])

		if(key === THEME){
			Browser.ApplyTheme(changes[key])
		}

		elem.removeAttribute("disabled")
		elem.removeAttribute("indeterminate")
	}
}

async function OnAccountsUpdate(changes){
	const existing = Array.from(ACCOUNTS_CONTAINER.getElementsByClassName("list-group-item")).filter(e=>e!==ACCOUNTS_ADD_BUTTON).map(e=>e.id)
	console.log("Clients Update:", changes, existing)
	existing.filter(x=>!changes.includes(x)).forEach(id=>{ // items removed
		ACCOUNTS_CONTAINER.removeChild(document.getElementById(id))
	})
	changes.filter(x=>!existing.includes(x)).forEach(async id=>{ // items added
		ACCOUNTS_CONTAINER.prepend(await CreateClientElem(await ACCOUNTS_CONTROLLER.GetClient(id)))
	})
}

function GetConfirmModal(titleAndPrimaryKey, contentsKey, CBFunc){
	return ()=>MODAL_CONTROLLER.DisplayModal({
		title:titleAndPrimaryKey, 
		primaryButton:titleAndPrimaryKey, 
		secondaryButton:"ob_modalCancel", 
		contents:contentsKey, 
		callback:(e, ok)=>{if(ok)return CBFunc()}
	})
}

window.onload = async ()=>{
	SETTINGS = await Settings.Create()
	Browser.ApplyTheme(await SETTINGS.Get(THEME))
	ACCOUNTS_CONTROLLER = await StreamClientController.Create()

	SETTINGS.OnUpdate(OnSettingsUpdate)
	ACCOUNTS_CONTROLLER.OnUpdate(OnAccountsUpdate)

	ACCOUNTS_ADD_BUTTON.addEventListener("change", OnAccountAddButtonSelected)

	CLEAR_ALL_DATA_BUTTON.addEventListener("click", GetConfirmModal("ob_modalClearAllData", "om_deleteAllModal", Browser.ClearStorage))
	OPTIONS_RESET_BUTTON.addEventListener("click", GetConfirmModal("ob_modalClearOptions", "om_resetOptionsModal", ()=>SETTINGS.Reset()))
	ACCOUNTS_RESET_BUTTON.addEventListener("click", GetConfirmModal("ob_modalClearAccounts", "om_deleteAccountsModal", ()=>ACCOUNTS_CONTROLLER.Delete()))

	LoadI18nTextToElem(CLEAR_ALL_DATA_BUTTON, "ob_modalClearAllData")
	LoadI18nTextToElem(OPTIONS_RESET_BUTTON, "ob_modalClearOptions")
	LoadI18nTextToElem(ACCOUNTS_RESET_BUTTON, "ob_modalClearAccounts")
	LoadI18nTextToElem(document.getElementById("accountsHeader"), "oh_accounts")
	LoadI18nTextToElem(document.getElementById("optionsHeader"), "oh_options")
	LoadI18nTextToElem(GetSelectOption(ACCOUNTS_ADD_BUTTON, o=>o.hasAttribute("hidden")), "ob_accountsAdd")

	LoadOptionsContainer(document.getElementById("optionsContainer"), SETTINGS.Keys(), key => SETTINGS.GetMetadata(key), async key => await SETTINGS.Get(key), (e)=>OnManualInputChange(e.target, SETTINGS))
	LoadClientsContainer()

	// setup add account dropdown
	StreamClientController.ClientTypes().forEach(type=>{ // setup the dropdown with available service types
		let elem = document.createElement("option")
		LoadI18nTextToElem(elem, "ol_" + type) // dont care when this completes, using .toString, because name could be a number
		elem.value = type
		ACCOUNTS_ADD_BUTTON.appendChild(elem)
	})
}