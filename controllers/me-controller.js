import { ServerError, ServerGenericError, ServerNotAllowed, ServerNotFound } from '../config/errors'

export default module.exports = (app) => {
  const Model = app.models.User

  return {
    me: (req, res) => {
      if (!req.user) {
        throw new ServerNotAllowed('User is not authenticated')
      }
      return Model.findById(req.user.id)
        .then((foundData) => {
          if (!foundData) {
            throw new ServerNotFound(Model.name, req.user.id, `${Model.name} with id ${req.params.id} not found`)
          }
          res.json(foundData)
          return foundData
        })
        .catch((error) => {
          if (error instanceof ServerError) {
            throw error
          } else {
            throw new ServerGenericError(error)
          }
        })
    },
    permissions: (req, res) => {
      const ret = app.auth.ListACLForUserSync(req.user.id)
      res.json(ret)
      return app.Promise.resolve(ret)
    }
  }
}
