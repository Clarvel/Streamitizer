import { Browser } from "./browser.js"

/**
 * @param {number} num 
 * @param {number} min 
 * @param {number} max 
 */
export function Clamp(num, min, max){return Math.min(max, Math.max(min, num))}

/**
 * @param {object} obj 
 */
export function IsEmpty(obj){return Object.keys(obj).length === 0}

/**
 * @param {string} str 
 * @param  {...string} inputs 
 */
/*export function FormatString(str, ...inputs){
	return str.replace(/{(\d+)}/g, (match, number)=>{ 
		return inputs[number] != null ? inputs[number] : match
	})
}*/

/**
 * @param {string} str 
 * @param  {* || []} input
 */
export function FormatString(str, input){
	return str.replace(/{(.+?)}/g, (match, number) => input[number] ?? match)
}

export function IsStr(str){return typeof str === 'string' || str instanceof String}

export function IsStrWithVal(str){
	return IsStr(str) && str.trim().length > 0
}

/**
 * @param {object} data 
 */
export function EncodeQuery(data){
	let keys = Object.keys(data)
	return keys.length === 0 ? '' : keys.map(key=>encodeURIComponent(key)+'='+encodeURIComponent(data[key])).join('&')
}

export function DecodeUriQuery(uri){
	let index = uri.indexOf("?")
	if(index == -1)
		index = uri.indexOf("#")+1
	return Object.fromEntries(new URLSearchParams(uri.slice(index)))
}

/**
 * @param {string} url_ 
 * @param {object} data 
 */
export function EncodeDataURL(url_, data){
	let query = EncodeQuery(data)
	return query ? (url_+'?'+query) : url_
}

/**
 * TODO replace this when chrome APIs allow promises
 * @param {Function} func 
 * @param {Array} vars 
 */
export function PromiseCB(func, ...vars){
	//console.log(func.name, ...vars)
	return new Promise((resolve, reject)=>{
		func(...vars, (result)=>{
			resolve(result)
		})
	})
}

/**
 * 
 * @param {*} obj 
 * @param {Function} valueFunc 
 * @param {Function} keyFunc
 */
export function ObjMap(obj, valueFunc, keyFunc=(v, k)=>k){
	return Object.fromEntries(Object.entries(obj).map(
    	([key, value], index) => [keyFunc(value, key, index), valueFunc(value, key, index)]
    )
  )
}

/**
 * 
 * @param {*} obj 
 * @param {Function} valueFunc 
 */
 export function ObjTF(obj, valueFunc){
	Object.values(obj).forEach(v=>obj[v] = valueFunc(v))
	return Object.fromEntries(Object.entries(obj).map(
    	([key, value], index) => [keyFunc(value, key, index), valueFunc(value, key, index)]
    )
  )
}

/**
 * 
 * @param {*} obj 
 * @param {Function} func  input: [key, value] array, output: boolean
 */
export function ObjFilter(obj, func){
	return Object.fromEntries(Object.entries(obj).filter(func))
}

/**
 * 
 * @param {*} obj 
 * @param {Array[string]} keys 
 */
export function Pick(obj, keys, deepCopy=false){
	return Object.fromEntries(keys.filter(k=>k in obj).map(k => [k, deepCopy ? JSON.parse(JSON.stringify(obj[k])) : obj[k]]))
}

/**
 * Handles an array of async funcs, returns an array of any resulting values
 * @param {Promise[]} funcs 
 * @param {boolean} excludeEmpty set to true if you want empty or failed entries automatically removed from the output
 */
export async function PromiseAll(funcs, excludeEmpty=false){
	let settled = await Promise.allSettled(funcs)
	console.warn(...settled.filter(r=>r.reason != null).map(r=>r.reason))
	if(excludeEmpty)
		settled = settled.filter(r=>r.reason == null ? r.value != null : false)
	return settled.map(r=>r.value)
}

/** TODO: replace when array.GroupBy is no longer experimental
 * @param {*[]} arr 
 * @param {Function} func input: * from array, output: string to group by
 */
export function GroupBy(arr, func){
	const obj = {}
	arr.forEach(a => (obj[func(a)] ??= []).push(a))
	return obj
}

/**
 * 
 * @param {*} obj 
 * @param {Array<string>} path 
 */
export function GetValueFromNestedObject(obj, path){
	for (const name of path) {
		if(obj == null)
			break
		obj = obj?.[name]
	}
	return obj
}

/**
 * 
 * @param {T} templateClass 
 * @param {*} obj 
 * @param {Array<string>} requiredParams
 * @returns {T} 
 * @template T
 */
export function CastObjectToClassInstance(templateClass, obj, requiredParams){
	return new templateClass(...requiredParams.map(x=>{
		if(x in obj)
			return obj[x]
		throw Error(`Missing ${x} in ${templateClass.name} constructor`)
	}), obj)
}

/**
 * @param {HTMLElement} parent 
 * @param {HTMLElement | string} child 
 */
export function AppendElemOrString(parent, child){
	if(typeof child === 'string' || child instanceof String)
		child = document.createTextNode(child)
	parent.appendChild(child)
}

/**
 * @param {HTMLElement} parent 
 * @param {HTMLElement | string} child 
 */
export function SetElemOrString(parent, child){
	if(typeof child === 'string' || child instanceof String)
		parent.textContent = child
	parent.replaceChildren(child)
}

/**
 * @param {HTMLSelectElement} selectElem 
 * @param {string} value 
 */
export function SetSelectByValue(selectElem, value){
	const option = GetSelectOption(selectElem, o=>o.value === value)
	if(option != null)
		selectElem.selectedIndex = option.index
}

/**
 * @param {HTMLSelectElement} selectElem 
 * @param {Function} func selector 
 * @returns {HTMLOptionElement}
 */
 export function GetSelectOption(selectElem, func){
	for(const option of selectElem.options){ // because options isn't an array?!?!
		if(func(option))
			return option
	}
}
/**
 * @param {HTMLSelectElement} selectElem 
 * @param {Number} index
 * @returns {HTMLOptionElement}
 */
export function GetSelectOptionByIndex(selectElem, index){
	return selectElem.options.item(index)
}

/**
 * @param {HTMLInputElement | HTMLSelectElement} elem 
 */
export function GetElemValue(elem){
	let _getIntOrStrFromStr = (str)=>{
		let num = parseInt(str, 10)
		return Number.isNaN(num) ? str : num	
	}
	switch(elem.nodeName){
		case "INPUT":
			switch(elem.type){
				case "checkbox":
					return elem.checked
				case "range":
					return _getIntOrStrFromStr(elem.value)
				case "text":
					return elem.value
			}
			break;
		case "SELECT":
			return _getIntOrStrFromStr(elem.options[elem.selectedIndex].value)
	}		
	throw Error("Unknown Element type: " + elem)
}

/**
 * @param {HTMLInputElement | HTMLSelectElement} elem 
 * @param {*} value 
 */
export function SetElemValue(elem, value){
	switch(elem.nodeName){
		case "INPUT":
			switch(elem.type){
				case "checkbox":
					elem.checked = value
					return
				case "range":
					elem.value = value
					return
				case "text":
					elem.value = value
			}
			break;
		case "SELECT":
			SetSelectByValue(elem, value.toString())
			return
	}		
	throw Error("Unknown Element type: " + elem)
}

/**
 * @param {string} textKey 
 * @param {Array<string>} replacements 
 * @returns {Promise<string>}
 */
export async function GetI18nText(textKey, replacements = undefined){
	try{
		return Browser.GetLocaleText(textKey, replacements)
	}catch(e){
		console.warn(`[${textKey}] key missing from loaded language`, e)
	}
	return textKey
}

/**
 * @param {HTMLElement} elem 
 * @param {string} textKey 
 * @param {Array<string>} replacements 
 */
export async function LoadI18nTextToElem(elem, textKey, replacements = undefined){
	//console.log(textKey, replacements, await GetI18nText(textKey, replacements))
	elem.textContent = await GetI18nText(textKey, replacements)
}

/**
 * 
 * @param {HTMLElement} parent 
 */
export function RemoveChildren(parent){
	let removed = []
	while(parent.firstChild){
		removed.push(parent.removeChild(parent.firstChild))
	}
	return removed
}

export async function AsyncFilter(array, asyncFunc){return Promise.all(array.map(asyncFunc)).then(r=>array.filter((_, i)=>r[i]))}

export async function ConsolidatePaginated(asyncFunc, filter=undefined, pageNum=0){
	const data = await asyncFunc(pageNum)
	if(!Array.isArray(data) || data.length === 0)
		return []
	
	if(filter != null){
		for(let index in data){
			if(filter(data[index])) // paged data is sorted via online first. if we hit a not-online sub, we've hit the end
				return data.slice(0, index)
		}
	}
	
	return data.concat(await ConsolidatePaginated(asyncFunc, filter, pageNum+1))
}

export function TrimChars(str, chars) {
    let start = 0, end = str.length;

    while(start < end && chars.indexOf(str[start]) >= 0)
        ++start;

    while(end > start && chars.indexOf(str[end - 1]) >= 0)
        --end;

    return (start > 0 || end < str.length) ? str.substring(start, end) : str;
}