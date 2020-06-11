config = require("config");

const setProperties = new Map();

module.exports.get= (property_name, property_default) => {
  let property;
  try {
    property = setProperties.get(property_name) || config.get(property_name);
  } catch(ex) {
    if (property_default !== undefined) {
      property = property_default;
    } else {
      throw(ex);
    }
  }
  return property;
}
module.exports.has = (property_name) => {
  return config.has(property_name) || setProperties.has(property_name);
}
module.exports.set = (property_name, property_value) => {
  setProperties.set(property_name, property_value);
  return setProperties.get(property_name);
}