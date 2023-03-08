import { Settings } from "./settings.js"
import { ID } from "./ID.js"

const LOCKS_KEY = "Locks"

export class LockController{
    constructor(){
        this._Settings = new Settings("Locks", {}, [LOCKS_KEY])
        this._Locks = {}

        this._Settings.OnUpdate(async c=>await this._Invoke(c))
    }

    /**
     * @param {string} lockID set to invokable function name
     * @param {Function} func 
     * @param {Number} timeout in milliseconds, default is 1 min
     */
    async Lock(lockID, func, timeout=60000){
        let existing = await this._Settings.Get(LOCKS_KEY) ?? {}
        const selfID = await ID.GetInstanceID()
        const now = Date.now()
        // if the lock doesn't exist, or if there are no unexpired foreign entries. I can overwrite my own locks.
        if(!lockID in existing || Object.entries(existing[lockID]).filter(([id, timeout])=>id !== selfID && timeout > now).length === 0){
            this._Locks[lockID] = func

            existing[lockID] = {[await ID.GetInstanceID()]:now+timeout}
            await this._Settings.Set(LOCKS_KEY, existing)
        }
    }

    /**
     * @param {string} lockID 
     */
    async Unlock(lockID){
        if(lockID in this._Locks)
            delete this._Locks[lockID]

        let existing = await this._Settings.Get(LOCKS_KEY)
        if(existing != null && lockID in existing){
            delete existing[lockID]
            await this._Settings.Set(LOCKS_KEY, existing)
        }
    }

    async _Invoke(changed){
        const selfID = await ID.GetInstanceID()
        const now = Date.now()

        Object.entries(changed[LOCKS_KEY] ?? {}).filter(([lockID, {id, timeout}])=>id === selfID).map(async([lockID, {id, timeout}])=>{
            if(timeout > now){ // if not expired
                try{
                    await this._Locks[lockID]() // invoke 
                }catch(e){
                    console.warn(e)
                    // TODO: update lock with warning?
                }
            }
            delete this._Locks[lockID]
        })
    }
}