
class GroupBuilder
{
    constructor()
    {
        this.idToGroup = new Map();
        this.allGroups = new Set();
    }

    get groupsById()
    {
        return this.idToGroup;
    }

    get groups()
    {
        return this.allGroups;
    }

    add(id, references)
    {
        // Get the group for this id
        let group = this.idToGroup.get(id);
        if (group == null)
        {
            group = new Set();
            this.idToGroup.set(id, group);
            this.allGroups.add(group);
        }

        // Add this item to the group
        group.add(id);

        // Add all references
        if (references)
        {
            for (let r of references)
            {
                let rGroup = this.idToGroup.get(r);
                if (rGroup && rGroup != group)
                {
                    // Combine the referenced group with this group
                    for (let gid of rGroup)
                    {
                        this.idToGroup.set(gid, group);
                        group.add(gid);
                    }
                    this.onMergeGroups?.(group, rGroup);
                    this.allGroups.delete(rGroup);
                }
                
                // Add the reference to the group
                group.add(r);
                this.idToGroup.set(r, group);
            }
        }

        return group;
    }
}

module.exports = GroupBuilder;