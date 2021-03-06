/*
ACL(object, permission):

Get all permissions for object's groups
Get all permissions for object itself

Get all user's groups

Set DENY permission

Check if any group permission is ok for this object: for groups/user

Check if any group have DENY permission: groups/user

Check if any object permission is allow: groups/user

Check if any object permission is DENY: groups/user

*/

import _ from 'lodash'
import { ServerNotAllowed } from '../config/errors'

const kindAllow = 'ALLOW'

const kindDeny = 'DENY'

const GuestUserId = -1

/*
ACL.Object:

 * id: identifier for object, like "Invoice"
 * permissions: [] array of permissions:
   * permission: permission name, like "read", "write"
   * users: list of users that have this permission of this kind:
     * id: userId
     * kind: permission, one of ALLOW/DENY
   * userGroups: list of groups that have this permission of this kind
*/

export default module.exports = (app) => {
  const aclObject = []
  const { UserGroup } = app.models

  if (!app.consts) {
    app.consts = {}
  }

  app.consts.kindAllow = kindAllow
  app.consts.kindDeny = kindDeny
  app.consts.GuestUserId = GuestUserId

  const FindOrAddObject = (objectId) => {
    let aObject = _.find(aclObject, { id: objectId.toLowerCase() })
    if (!aObject) {
      aObject = { id: objectId.toLowerCase(), permissions: [] }
      aclObject.push(aObject)
    }
    return aObject
  }

  const FindOrAddPermission = (aObject, permission) => {
    let aPermission = _.find(aObject.permissions, { permission: permission.toLowerCase() })
    if (!aPermission) {
      aPermission = { permission: permission.toLowerCase(), users: [], userGroups: [] }
      aObject.permissions.push(aPermission)
    }
    return aPermission
  }

  const CheckPermission = (userId, object, permission) => {
    let aKind = kindDeny
    // console.log(`CheckPermission( ${userId}, ${object}, ${permission})`)
    // console.log('aclObject:')
    // console.log(aclObject)
    // check if user is admin, and have all permissions:
    const adminGroup = UserGroup.systemGroupAdmin()
    // console.log(`Admin group: ${adminGroup}`)
    let groupRes = 0
    let aPermission = null
    return UserGroup.isUserInGroup(adminGroup, userId)
      .then((isAdmin) => {
        // console.log(`Check isUserInGroup(admin): ${isAdmin}`)
        if (isAdmin) {
          // console.log('user is admin, allow')
          return Promise.resolve(kindAllow)
        }

        // console.log('check if we have permission for user:')
        const aObject = _.find(aclObject, { id: object.toLowerCase() })
        if (!aObject) {
          // console.log('object not defined, DENY')
          return Promise.resolve(kindDeny) // no object defined, DENY
        }

        // console.log('find specified permission for object:')
        aPermission = _.find(aObject.permissions, { permission: permission.toLowerCase() })
        if (!aPermission) {
          // console.log('no such permission, DENY')
          return Promise.resolve(kindDeny) // no permission declaration, DENY
        }
        // console.log('Permissions found:')
        // console.log(aPermission)
        // check if we have some group permission:
        // console.log('checkGroups:')
        return UserGroup.findGroupsForUser(userId)
          .then((groups) => {
            // console.log(`found groups for user ${userId}:`)
            // console.log(groups)
            _.each(groups, (group) => {
              // console.log(` - group: ${group.id} ${group.name}`)
              const aGroup = _.find(aPermission.userGroups, { id: group.id })
              if (aGroup && groupRes !== kindDeny) {
                // console.log(`set kind === ${aGroup.kind}`)
                groupRes = aGroup.kind
              }
            })
            // console.log(`groupRes = ${groupRes}`)
            // check if specified object have exact user permission:
            let userRes = 0
            const aUser = _.find(aPermission.users, { id: userId })
            if (aUser) {
              // console.log(`user have specific permission ${aUser.kind}`)
              userRes = aUser.kind
            }
            // set resulting permission according proprieties:
            if (groupRes !== 0) {
              aKind = groupRes
            }
            if (userRes !== 0) {
              aKind = userRes
            }
            return Promise.resolve(aKind)
          })
          .catch((err) => { throw err })
      })
      .catch((err) => { throw err })
  }
  return {
    ACL: (object, permission) => {
      return (req, res, next) => {
        // console.log(`ACL`)
        const auth = app.auth.passport.authenticate('jwt', { session: false })
        auth(req, res, () => {
          // console.log(`ACL.auth: req.user=${req.user.id} ${req.user.email}`)
          let aUserId = null

          if (req.user) {
            // console.log('req.user authed')
            aUserId = req.user.id
          } else {
            // console.log('user not authed, guest user')
            aUserId = GuestUserId
          }

          return CheckPermission(aUserId, object, permission)
            .then((perm) => {
              if (perm === kindAllow) {
                // console.log('permission === allow')
                next() // user have allow kind of permission for this object/permission
              } else {
                // console.log('permission === deny')
                next(new ServerNotAllowed(`Permission deny for user on ${object}.${permission}`))
              }
            })
        })
      }
    },
    AddUserPermission: (userId, objectId, permission, kind) => {
      let aKind = kindAllow
      if (kind) {
        aKind = kind.toUpperCase()
      }

      const aObject = FindOrAddObject(objectId)
      const aPermission = FindOrAddPermission(aObject, permission)
      let aUser = _.find(aPermission.users, { id: userId })
      if (!aUser) {
        aPermission.users.push({ id: userId, kind: aKind })
      } else {
        aUser.kind = aKind
      }
      return {
        userId,
        object: objectId.toLowerCase(),
        permission: permission.toLowerCase(),
        kind: kind.toUpperCase()
      }
    },
    AddGroupPermission: (groupId, objectId, permission, kind) => {
      // console.log(`AddGroupPermission: ${groupId}, ${objectId}, ${permission}, ${kind}`)
      let aKind = kindAllow
      if (kind) {
        aKind = kind.toUpperCase()
      }

      const aObject = FindOrAddObject(objectId)
      const aPermission = FindOrAddPermission(aObject, permission)
      let aGroup = _.find(aPermission.userGroups, { id: groupId })
      if (!aGroup) {
        aPermission.userGroups.push({ id: groupId, kind: aKind })
      } else {
        aGroup.kind = aKind
      }
      return {
        groupId,
        object: objectId.toLowerCase(),
        permission: permission.toLowerCase(),
        kind: kind.toUpperCase()
      }
    },
    ListACL: () => {
      return aclObject
    },
    ListACLForUserSync: (userId) => {
      const arr = []
      _.forEach(aclObject, (item) => {
        _.forEach(item.permissions, (perm) => {
          const aUser = _.find(perm.users, { id: userId })
          if (aUser) {
            const ret = { object: item.id, permission: perm.permission, kind: aUser.kind || kindAllow }
            arr.push(ret)
          }
        })
      })
      return arr
    },
    ListACLForUserGroupSync: (groupId) => {
      const arr = []
      _.forEach(aclObject, (item) => {
        _.forEach(item.permissions, (perm) => {
          const aItem = _.find(perm.userGroups, { id: groupId })
          if (aItem) {
            const ret = { object: item.id, permission: perm.permission, kind: aItem.kind || kindAllow }
            arr.push(ret)
          }
        })
      })
      return arr
    }
  }
}
