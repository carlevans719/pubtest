import { Model } from '@webantic/meteor-models'
import { Mongo } from 'meteor/mongo'

Model.configure({
  Mongo
})

Stationary = new Model('stationary', {
})

Pens = new Model('pens', {
})

Inks = new Model('inks', {

})

Pencils = new Model('pencils', {

})

Weights = new Model('weights', {

})
