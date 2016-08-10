describe('Routes: Index', () => {
  describe('GET /', () => {
    it('returns', done => {
      request.get('/')
        .expect(200)
        .end((err, res) => {
          const expected  = {status: 'Report API'};
          expect(res.body).to.eql(expected);
          done(err);
        });
    });
  });
});
