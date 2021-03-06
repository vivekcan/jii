import bcrypt from 'bcrypt'
import multiparty from 'multiparty'
import Storage from '../../../../lib/storage'
import utils from '../../../../lib/utils'

const storage = new Storage()

const select = (req, res) => {
  const guid = req.params.guid ? req.params.guid.split('.')[0] : null

  storage.find(guid, (err, file) => {
    if (err || file === null) {
      return res.status(404).json({
        statusCode: 404,
        error: 'Not Found',
      })
    }

    delete file.metadata
    delete file.aliases

    res.json(file)
  })
}

const create = (req, res) => {
  storage.permissions(req.headers.authorization || null, (error) => {
    if (error) {
      return res.status(401).json({ statusCode: 401, error: error.message})
    }

    const form = new multiparty.Form()
    const data = {}
    let fileUpload = false
    let handleErr = true

    form.on('error', (error) => {
      if (handleErr) {
        handleErr = false
        return res.status(400).json(error)
      }
    })

    form.on('field', (field, value) => {
      data[field] = value
    })

    form.on('part', (part) => {
      part.on('error', (error) => {
        if (handleErr) {
          handleErr = false
          return res.status(400).json(error)
        }
      })

      if (!part.filename || part.name !== 'file') {
        part.resume()
      } else {
        fileUpload = true
      }

      const fileData = storage.new({ ...data, name: part.filename, headers: part.headers }, 'file')
      storage.processUpload(fileData, part, (error, file) => {
        if (error) {
          return res.status(409).json({
            statusCode: 409,
            error,
          })
        }

        return res.json(file)
      })
    })

    form.on('close', () => {
      // TODO: handle close emitter correctly
      // return res.status(400).json({})
    })

    form.parse(req)
  })
}

const remove = (req, res) => {
  const { guid = null, hash = null } = req.params
  storage.find(guid, (err, file) => {
    if (err || file === null) {
      return res.status(404).json({
        statusCode: 404,
        error: 'Not Found',
      })
    }

    bcrypt.compare(hash, file.metadata.deleteHash, (err, match) => {
      if (match) {
        return storage.delete(file, (err, data) => {
          return res.status(200).json({
            statusCode: 200,
            message: 'The file has been deleted.',
          })
        })
      }

      res.status(401).json({
        statusCode: 401,
        error: 'You have provided an invalid deletion hash.',
      })
    })
  })
}

export default {
  select,
  create,
  remove,
}
