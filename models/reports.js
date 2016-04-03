module.exports = app => {
  return {
    findAll: (params, callback) => {
      return callback([
        {title: 'monster'},
        {title: 'pizza'}
      ]);
    }
  };
};
