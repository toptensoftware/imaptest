
class ListPatch
{
    // Given two objects, create a new object such that Object.assign(oldObject, patch)
    // will update oldObject to be shallowly equivalent to newObject.  Only works
    // on objects with simple property values (no nested arrays, objects etc...)
    static build_patch(oldObj, newObj)
    {
        let patch = null;
        for (let [k,v] of Object.entries(newObj))
        {
            if (oldObj[k] == v)
                continue;

            if (patch == null)
                patch = {};
            patch[k] = newObj[k];
        }

        for (let [k,v] of Object.entries(oldObj))
        {
            if (!newObj.hasOwnProperty(k))
            {
                if (patch == null)
                    patch = {};
                patch[k] = undefined;
            }
        }

        return patch;
    }

    static apply_patch(oldObj, patch)
    {
        if (!patch)
            return;
        
        for (let [k,v] of Object.entries(patch))
        {
            if (v === undefined)
                delete oldObj[k];
            else
                oldObj[k] = v;
        }
    }

    // Generates a list of edits to make two sorted arrays equal
    // (will work on unsorted arrays but will often give terrible results)
    //
    // The return value is an array of operations:
    // {
    //     o:      'i' = insert, 'd' = delete, 'u' = update
    //     i:      the index in the old array (adjusted for prior inserts/deleted)
    //     c:      for delete opertions, the number of items to delete (1 if not specified)
    //     d:      for insert and patch operations the item to insert/patch
    //     ds:     instead of `d` an array of consecutive items to insert/patch
    // }
    //
    // The compare callback is passed two objects (a and b) and should return a comparison
    // result between them:
    //    a < b => -1
    //    a > b => 1
    //    a == b => 0           (if the items are the same)
    //
    // The patch function take two object that compared equally and returns an object that
    // contains a set of new property values to be assigned to the new list item.  Or null if
    // the object hasn't changed
    static build_list_patch(oldList, newList, compare, patch)
    {
        let edits = [];
        let oi = 0;
        let ni = 0;
        let adjust = 0;
        let olen = oldList.length;
        let nlen = newList.length;

        function push_delete(index)
        {
            if (edits.length > 0)
            {
                let prev = edits[edits.length - 1];
                if (prev.o == 'd' && prev.i == index)
                {
                    if (!prev.c)
                        prev.c = 2;
                    else
                        prev.c++;
                    return;
                }
            }

            // Non-coalesced
            edits.push({o:'d',i:index});
        }

        function push_insert(i, d)
        {
            if (edits.length > 0)
            {
                let prev = edits[edits.length - 1];
                let prevCount = prev.ds ? prev.ds.length : 1;
                if (prev.o == 'i' && prev.i + prevCount == i)
                {
                    if (prev.ds)
                    {
                        prev.ds.push(d);
                    }
                    else
                    {
                        prev.ds = [prev.d, d];
                        delete prev.d;
                    }
                    return;
                }
            }
            edits.push( { o: "i", i, d } );
        }

        function push_patch(i, d)
        {
            if (edits.length > 0)
            {
                let prev = edits[edits.length - 1];
                let prevCount = prev.ds ? prev.ds.length : 1;
                if (prev.o == 'u' && prev.i + prevCount == i)
                {
                    if (prev.ds)
                    {
                        prev.ds.push(d);
                    }
                    else
                    {
                        prev.ds = [prev.d, d];
                        delete prev.d;
                    }
                    return;
                }
            }
            edits.push( { o: "u", i, d });
        }


        while (oi < olen || ni < nlen)
        {
            // Get entries
            let o = oi < olen ? oldList[oi] : null;
            let n = ni < nlen ? newList[ni] : null;
    
            // New entry at end?
            if (o == null)
            {
                push_insert(oi + adjust, n);
                adjust++;
                ni++;
                continue;
            }
    
            // Remove entry at end
            if (n == null)
            {
                push_delete(oi + adjust);
                adjust--;
                oi++;
                continue;
            }

            // Compare items
            let diff = compare(o, n);

            // Same item unchanged
            if (diff == 0)
            {
                // Same item, but does it need patching?
                let p = patch(o, n);
                if (p)
                {
                    push_patch(oi + adjust, p);
                }

                oi++;
                ni++;
                continue;
            }

            if (diff < 0)
            {
                // Delete old item
                push_delete(oi + adjust);
                oi++;
                adjust--;
            }
            else
            {
                // Insert new item
                push_insert(oi + adjust, n);
                ni++;
                adjust++;
            }
        }     
        
        return edits;
    }

    static apply_list_patch(oldList, patch)
    {
        for (let op of patch)
        {
            switch (op.o)
            {
                case 'i':
                    if (op.ds)
                        oldList.splice(op.i, 0, ...op.ds);
                    else
                        oldList.splice(op.i, 0, op.d);
                    break;

                case 'u':
                    if (op.ds)
                    {
                        for (let i=0; i<op.ds.length; i++)
                        {
                            ListPatch.apply_patch(oldList[op.i + i], op.ds[i]);
                        }
                    }
                    else
                        ListPatch.apply_patch(oldList[op.i], op.d);
                    break;

                case 'd':
                    oldList.splice(op.i, op.c ?? 1);
                    break;
            }
        }
    }

}

module.exports = ListPatch;