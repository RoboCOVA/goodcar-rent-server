import { body, param } from 'express-validator/check'
import InviteController from '../controllers/invite-controller'
import paramCheck from '../services/param-check'

export default (app) => {
  const router = app.express.Router()
  const controller = InviteController(app)

  // noinspection JSCheckFunctionSignatures
  router.route('/auth/invite')
    // .all(app.auth.authenticate())
    .all(app.auth.ACL('/auth/invite', 'read'))
    .get(app.wrap(controller.list))
    .post(app.auth.ACL('/auth/invite', 'write'),
      [
        body('email').isEmail().isLength({ min: 5 }).withMessage('Email should be provided'),
        body('expireAt').optional().isAfter().withMessage('ExpireAt should be greater than now'),
        body('disabled').optional().isBoolean().withMessage('Invite disabled state should be boolean value'),
        body('createdBy').optional().isString(),
        body('assignUserGroups').optional().isArray()
      ], paramCheck,
      app.wrap(controller.create))

  // noinspection JSCheckFunctionSignatures
  router.route('/auth/invite/:id')
    .all(app.auth.ACL('/auth/invite', 'read'),
    // .all(app.auth.authenticate(),
      [
        param('id').isString().withMessage('Invite id should be specified')
      ], paramCheck)
    .get(app.wrap(controller.item))
    .put(app.auth.ACL('/auth/invite', 'write'), app.wrap(controller.save))
    .delete(app.auth.ACL('/auth/invite', 'write'), app.wrap(controller.delete))

  router.route('/auth/invite/:id/send')
    .all(app.auth.ACL('/auth/invite', 'write'),
    // .all(app.auth.authenticate(),
      [
        param('id').isString().withMessage('Invite id should be specified')
      ], paramCheck)
    .get(app.wrap(controller.send))

  return router
}
