import { PROVIDER_TYPES, StreamsService } from "../streamsService.js"
import { Browser } from "../browser.js"
import { LoadI18nTextToElem, SetElemValue, GetElemValue, GetSelectOption, Clamp, GetI18nText } from "../utils.js"
import { Settings, MetadataSettings } from "../settings.js"
import { DisplayErrorModal, DisplayModal } from "./modalController.js"
import { CLIENTS_KEY, DEFAULT, THEME } from "../IDs.js"

const OPTIONS_CONTAINER = document.getElementById("optionsContainer")
const ACCOUNTS_CONTAINER = document.getElementById("accountsContainer")
const ACCOUNTS_ADD_BUTTON = document.getElementById("accountsAdd")
const ACCOUNTS_RESET_BUTTON = document.getElementById("accountsReset")
const OPTIONS_RESET_BUTTON = document.getElementById("optionsReset")
const CLEAR_ALL_DATA_BUTTON = document.getElementById("clearAllData")

const STREAMTYPE_TEMPLATE = document.getElementById("streamTypeTemplate").content
const ACCOUNT_TEMPLATE = document.getElementById("accountTemplate").content
const BOOL_TEMPLATE = document.getElementById("boolTemplate").content
const SELECT_TEMPLATE = document.getElementById("selectTemplate").content
const RANGE_TEMPLATE = document.getElementById("rangeTemplate").content
const ERROR_TEMPLATE = document.getElementById("errorTemplate").content

const SETTINGS = new MetadataSettings("../options.json")

async function OnAccountButton(evt, promise){
	const elem = evt.target
	elem.setAttribute("disabled", "")
	return promise.catch(e => {
		console.warn(e)
		DisplayErrorModal(e.message)
	}).finally(() => elem.removeAttribute("disabled"))
}

/**
 * Handles saving changes made to HTML inputs
 * @param {HTMLInputElement | HTMLSelectElement} inputElem 
 * @param {Settings} settings 
 */
async function OnManualInputChange(inputElem){
	inputElem.setAttribute("disabled", "")
	inputElem.setAttribute("indeterminate", "")

	try{
		return await SETTINGS.Set(inputElem.id, GetElemValue(inputElem)) // handle removing the attribute when we get the onChanged confirmation
	}catch(e){
		console.warn(e)
		try{
			SetElemValue(inputElem, await SETTINGS.Get(inputElem.id))
			DisplayErrorModal(e.message)
		}catch(e1){
			console.warn(e1)
		}
	}

	inputElem.removeAttribute("disabled")
	inputElem.removeAttribute("indeterminate")
}

function ImportTemplate(template, selector="input, select"){
	const templateElem = document.importNode(template, true)
	return [templateElem, templateElem.querySelector(selector)]
}

async function LoadOptionsContainer(){
	OPTIONS_CONTAINER.textContent = "" // clear out the OPTIONS_CONTAINER
	
	let meta = await SETTINGS.GetMetadata()
	for (const [k, v] of meta.filter(([k, v]) => v != null)) {
		try{
			let elem, input
			if("options" in v){
				[elem, input] = ImportTemplate(SELECT_TEMPLATE)
				for(const option of v["options"]){
					const e = document.createElement("option")
					LoadI18nTextToElem(e, k + option.toString()) // dont care when this completes, using .toString, because name could be a number
					e.value = option
					input.appendChild(e)
				}
			}else if("min" in v && "max" in v){
				[elem, input] = ImportTemplate(RANGE_TEMPLATE, `input[type="range"]`)
				const sInput = elem.querySelector(`input[type="number"]`)
				input.addEventListener("input", e => sInput.value = e.target.value)
				input.min = sInput.min = v["min"]
				input.max = sInput.max = v["max"]
				sInput.addEventListener("input", e => {
					if(!!e.target.value) // must be a non-empty string, otherwise reset e.target.value
						input.value = Clamp(e.target.value, v["min"], v["max"])
						// this fall-through is intentional and important to reset e.target if value is clamped
					e.target.value = input.value
				})
				sInput.addEventListener('change', e => {
					if(!!e.target.value && e.target.value >= v["min"] && e.target.value <= v["max"]){
						OnManualInputChange(input) // at this point input and sInput should be synced
					}
				})
				if(!v["disabled"])
					sInput.removeAttribute("disabled")
				sInput.removeAttribute("indeterminate")
				SetElemValue(sInput, v[DEFAULT])
			}else if(typeof v["value"] === 'boolean'){
				[elem, input] = ImportTemplate(BOOL_TEMPLATE)
			}else{
				throw Error(`Unknown Setting Type: ${v}`)
			}
		
			const label = elem.querySelector("label")
			LoadI18nTextToElem(label, k) // don't care when this completes
			input.id = label.htmlFor = k
				
			SetElemValue(input, v[DEFAULT])
			input.addEventListener('change', e => OnManualInputChange(e.target))
			
			v["disabled"] ? elem.firstElementChild.classList.add("disabled") : input.removeAttribute("disabled")
			input.removeAttribute("indeterminate")
			//console.log(elem)
			OPTIONS_CONTAINER.appendChild(elem) // do this last because it leaves an empty docfrag
		}catch(e){
			console.warn("Failed to create element for setting: " + k, e)
		}
	}
}

async function LoadClientsContainer(){
	const dropdown = ACCOUNTS_CONTAINER.lastElementChild
	ACCOUNTS_CONTAINER.textContent = ""
	const [accounts, errors] = await Promise.all([StreamsService.GetClientNames(), StreamsService.GetErrors()])
	ACCOUNTS_CONTAINER.append(...Object.entries(accounts).map(([provider, clients])=>{
		const providerElem = document.importNode(STREAMTYPE_TEMPLATE, true)
		providerElem.querySelector("img").src = `../icons/${provider}.png`
		LoadI18nTextToElem(providerElem.querySelector("h3"), provider)
		const listElem = providerElem.querySelector("ul")
		listElem.append(...Object.entries(clients).map(([UID, name])=>{
			const clientElem = document.importNode(ACCOUNT_TEMPLATE, true)
			clientElem.querySelector("label").textContent = name
			const reconnectBtn = clientElem.querySelector("button[name='reconnect']")
			reconnectBtn.addEventListener("click", evt => OnAccountButton(evt, StreamsService.Create(provider, UID)))
			clientElem.querySelector("button[name='remove']").addEventListener("click", evt => OnAccountButton(evt, StreamsService.Delete(provider, UID)))
			const errs = errors?.[provider]?.[UID]
			if(errs && Object.keys(errs).length > 0){
				clientElem.querySelector(`.errors`).classList.remove("d-none")
				clientElem.querySelector(".errors").append(...Object.entries(errs).map(([message, count])=>{
					const el = document.importNode(ERROR_TEMPLATE, true)
					el.querySelector(".desc").textContent = message//.slice(0, 3)
					el.querySelector(".count").textContent = count
					el.querySelector(".remove").addEventListener("click", async (e)=>{
						e.stopPropagation();
						await StreamsService.ClearError(provider, UID, message)
						e.target.parentNode.remove()
					})
					return el
				}))
			}else{
				reconnectBtn.style.display = "none"
			}
			return clientElem
		}))
		return providerElem
	}), dropdown)
}

async function OnAccountAddButtonSelected(evt){
	const type = evt.target.value // get option type value and reset dropdown
	ACCOUNTS_ADD_BUTTON.selectedIndex = GetSelectOption(ACCOUNTS_ADD_BUTTON, o=>o.hasAttribute("hidden")).index
	try{
		await StreamsService.Create(type)
	}catch(e){
		console.warn(e)
		DisplayErrorModal(e.message)
	}
}

async function OnStorageChanged(changes){
	console.debug("Settings Update:", changes)
	const metadataKeys = SETTINGS.GetMetadata().then(r => r.map(([k, v]) => k))
	for(const [k, v] of changes){
		switch(k){
			case CLIENTS_KEY:
				LoadClientsContainer()
				break;
			case THEME:
				Browser.ApplyTheme(v)
				// case fallthrough intentional
			default:
				if((await metadataKeys).includes(k)){
					function SetVal(elem){
						SetElemValue(elem, v)
						elem.removeAttribute("disabled")
						elem.removeAttribute("indeterminate")
						return elem
					}
					let e = document.getElementById(k)
					SetVal(e)
					if(e.type === "range")
						SetVal(e.parentElement.querySelector(`input[type="number"]`))
				}
		}
	}
}

function GetConfirmModal(titleAndPrimaryKey, contentsKey, CBFunc){
	const TPM = GetI18nText(titleAndPrimaryKey)
	return () => DisplayModal(TPM, TPM, GetI18nText(contentsKey), GetI18nText("cancel"), (e, ok)=>{if(ok)return CBFunc()})
}

SETTINGS.OnUpdate(OnStorageChanged)

window.onload = async ()=>{
	SETTINGS.GetSingle(THEME).then(Browser.ApplyTheme)

	ACCOUNTS_ADD_BUTTON.addEventListener("change", OnAccountAddButtonSelected)
	CLEAR_ALL_DATA_BUTTON.addEventListener("click", GetConfirmModal("clearAllData", "deleteAllModal", Browser.ClearStorage))
	OPTIONS_RESET_BUTTON.addEventListener("click", GetConfirmModal("clearOptions", "resetOptionsModal", ()=>SETTINGS.Reset()))
	ACCOUNTS_RESET_BUTTON.addEventListener("click", GetConfirmModal("clearAccounts", "deleteAccountsModal", StreamsService.DeleteAll))

	LoadI18nTextToElem(CLEAR_ALL_DATA_BUTTON, "clearAllData")
	LoadI18nTextToElem(OPTIONS_RESET_BUTTON, "clearOptions")
	LoadI18nTextToElem(ACCOUNTS_RESET_BUTTON, "clearAccounts")
	LoadI18nTextToElem(document.getElementById("accountsHeader"), "accounts")
	LoadI18nTextToElem(document.getElementById("optionsHeader"), "options")
	LoadI18nTextToElem(GetSelectOption(ACCOUNTS_ADD_BUTTON, o=>o.hasAttribute("hidden")), "accountsAdd")

	LoadOptionsContainer()
	LoadClientsContainer()

	for(const provider of await PROVIDER_TYPES()){ // setup the dropdown with available service types
		const elem = document.createElement("option")
		LoadI18nTextToElem(elem, provider) // dont care when this completes
		elem.value = provider
		ACCOUNTS_ADD_BUTTON.appendChild(elem)
	}
}