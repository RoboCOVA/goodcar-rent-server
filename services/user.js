import uuid from 'uuid/v4'
import bcrypt from 'bcrypt'
import {
  genericClearData,
  genericCount,
  genericDelete,
  genericFindAll,
  genericFindById,
  genericFindOne
} from './generic-model'

const _users = []

/*
  id
  email
  password
  invitedBy
  inviteDate
  inviteId -> Invite.id
*/

export default module.exports = (app) => {
  return {
    findById: genericFindById(_users),
    findOne: genericFindOne(_users),
    findAll: genericFindAll(_users),
    count: genericCount(_users),
    delete: genericDelete(_users),
    ClearData: genericClearData(_users),
    create: (item) => {
      item.id = uuid()
      const salt = bcrypt.genSaltSync()
      item.password = bcrypt.hashSync(item.password, salt)

      _users.push(item)
      return Promise.resolve(item)
    },
    isPassword: (encodedPassword, password) => bcrypt.compareSync(password, encodedPassword)
  }
}
