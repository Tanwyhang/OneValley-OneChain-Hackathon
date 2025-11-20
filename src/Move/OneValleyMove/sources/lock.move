/// The `lock` module offers an API for wrapping any object that has
/// `store` and protecting it with a single-use `Key`.
///
/// This is used to commit to swapping a particular object in a
/// particular, fixed state during escrow.
module one_valley_gamefi::lock {
    
    // === Errors ===
    const ELockKeyMismatch: u64 = 0;

    // === Structs ===

    /// A wrapper that protects access to `obj` by requiring access to a `Key`.
    ///
    /// Used to ensure an object is not modified if it might be involved in a
    /// swap.
    public struct Locked<T: store> has key, store {
        id: UID,
        key: ID,
        obj: T,
    }

    /// Key to open a locked object (consuming the `Key`)
    public struct Key has key, store {
        id: UID
    }

    // === Public Functions ===

    /// Lock `obj` and get a key that can be used to unlock it.
    public fun lock<T: store>(
        obj: T,
        ctx: &mut TxContext,
    ): (Locked<T>, Key) {
        let key = Key { id: object::new(ctx) };
        let lock = Locked {
            id: object::new(ctx),
            key: object::id(&key),
            obj,
        };
        (lock, key)
    }

    /// Unlock the object in `locked`, consuming the `key`.  Fails if the wrong
    /// `key` is passed in for the locked object.
    public fun unlock<T: store>(locked: Locked<T>, key: Key): T {
        assert!(locked.key == object::id(&key), ELockKeyMismatch);
        let Key { id } = key;
        object::delete(id);

        let Locked { id, key: _, obj } = locked;
        object::delete(id);
        obj
    }

    // === View Functions ===

    /// Get the ID of the key that can unlock this locked object
    public fun key_id<T: store>(locked: &Locked<T>): ID {
        locked.key
    }

    /// Get the ID of the key object
    public fun key_id_key(key: &Key): ID {
        object::id(key)
    }

    // === Test Functions ===
    #[test_only]
    public fun destroy_locked<T: key + store>(locked: Locked<T>) {
        let Locked { id, key: _, obj } = locked;
        object::delete(id);
        transfer::public_transfer(obj, @0x0); // Send to burn address
    }

    #[test_only]
    public fun destroy_key(key: Key) {
        let Key { id } = key;
        object::delete(id);
    }
}