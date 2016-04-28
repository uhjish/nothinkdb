import r from 'rethinkdb';
import Joi from 'joi';
import uuid from 'node-uuid';
import { expect } from 'chai';
import Table from '../Table';
import schema from '../schema';
import Link from '../Link';
import { hasOne, belongsTo, hasMany, belongsToMany } from '../relations';


describe('Table', () => {
  let connection;
  before(async () => {
    connection = await r.connect({});
    await r.branch(r.dbList().contains('test').not(), r.dbCreate('test'), null).run(connection);
    r.dbCreate('test');
  });

  after(async () => {
    await connection.close();
  });

  describe('constructor', () => {
    it('schema could be extended', () => {
      const baseTable = new Table({
        tableName: 'base',
        schema: () => ({
          ...schema,
          name: Joi.string().default('hello'),
        }),
      });
      expect(baseTable.schema()).to.have.property('id');
      expect(baseTable.schema()).to.have.property('createdAt');
      expect(baseTable.schema()).to.have.property('updatedAt');
      expect(baseTable.schema()).to.have.property('name');
    });
  });

  describe('validate', () => {
    const fooTable = new Table({
      tableName: 'foo',
      schema: () => ({
        name: Joi.string().required(),
      }),
    });

    it('should return true when data is valid', () => {
      expect(fooTable.validate({ name: 'foo' })).to.be.true;
    });

    it('should throw error when invalid', () => {
      expect(fooTable.validate({})).to.be.false;
    });
  });

  describe('create', () => {
    const fooTable = new Table({
      tableName: 'foo',
      schema: () => ({
        foo: Joi.string().default('foo'),
        bar: Joi.string().required(),
      }),
    });

    it('should return with default properties', () => {
      const result = fooTable.create({ bar: 'bar' });
      expect(result).to.have.property('foo', 'foo');
      expect(result).to.have.property('bar', 'bar');
    });

    it('should throw error when invalid', () => {
      expect(() => fooTable.create({})).to.throw(Error);
    });
  });

  describe('hasField', () => {
    it('should return true when specified fieldName is given', () => {
      const fooTable = new Table({
        tableName: 'foo',
        schema: () => ({
          name: Joi.string(),
        }),
      });
      expect(fooTable.hasField('name')).to.be.true;
    });

    it('should return false when unspecified fieldName is given', () => {
      const fooTable = new Table({
        tableName: 'foo',
        schema: () => ({}),
      });
      expect(fooTable.hasField('name')).to.be.false;
    });
  });

  describe('assertField', () => {
    it('should not throw error when specified fieldName is given', () => {
      const fooTable = new Table({
        tableName: 'foo',
        schema: () => ({
          name: Joi.string(),
        }),
      });
      expect(() => fooTable.assertField('name')).to.not.throw(Error);
    });

    it('should throw error when unspecified fieldName is given', () => {
      const fooTable = new Table({
        tableName: 'foo',
        schema: () => ({}),
      });
      expect(() => fooTable.assertField('name')).to.throw(Error);
    });
  });

  describe('getField', () => {
    it('should return field schema when specified fieldName is given', () => {
      const fooTable = new Table({
        tableName: 'foo',
        schema: () => ({
          name: Joi.string(),
        }),
      });

      const field = fooTable.getField('name');
      expect(field).to.be.ok;
      expect(() => Joi.assert('string', field)).to.not.throw(Error);
    });

    it('should throw error when unspecified fieldName is given', () => {
      const fooTable = new Table({
        tableName: 'foo',
        schema: () => ({}),
      });
      expect(() => fooTable.getField('name')).to.throw(Error);
    });
  });

  describe('getForeignKey', () => {
    it('should return primary key schema when any argument is not given', () => {
      const fooTable = new Table({
        tableName: 'foo',
        pk: 'name',
        schema: () => ({
          name: Joi.string().default(() => uuid.v4(), 'pk'),
        }),
      });

      const field = fooTable.getForeignKey();
      expect(field).to.be.ok;
      expect(() => Joi.assert('string', field)).to.not.throw(Error);
    });

    it('should return field schema when options.fieldName is given', () => {
      const fooTable = new Table({
        tableName: 'foo',
        schema: () => ({
          name: Joi.string().default(() => uuid.v4(), 'pk'),
        }),
      });

      const field = fooTable.getForeignKey({ fieldName: 'name' });
      expect(field).to.be.ok;
      expect(() => Joi.assert('string', field)).to.not.throw(Error);
    });

    it('should return and default(null) schema when options.isManyToMany is not given', () => {
      const fooTable = new Table({
        tableName: 'foo',
        schema: () => ({
          ...schema,
        }),
      });

      const field = fooTable.getForeignKey();
      expect(field).to.be.ok;
      expect(Joi.attempt(undefined, field)).to.be.null;
    });

    it('should return required() field schema when options.isManyToMany is given', () => {
      const fooTable = new Table({
        tableName: 'foo',
        schema: () => ({
          ...schema,
        }),
      });

      const field = fooTable.getForeignKey({ isManyToMany: true });
      expect(field).to.be.ok;
      expect(() => Joi.assert(undefined, field)).to.throw(Error);
    });
  });

  describe('linkTo', () => {
    it('should return link', () => {
      const fooTable = new Table({
        tableName: 'foo',
        schema: () => ({
          ...schema,
          barId: barTable.getForeignKey(),
        }),
      });
      const barTable = new Table({
        tableName: 'bar',
        schema: () => ({
          ...schema,
        }),
      });

      const foo2bar = fooTable.linkTo(barTable, 'barId');
      expect(foo2bar).to.be.ok;
      expect(foo2bar.constructor).to.equal(Link);
      expect(foo2bar.left).to.deep.equal({
        table: fooTable, field: 'barId',
      });
      expect(foo2bar.right).to.deep.equal({
        table: barTable, field: 'id',
      });
    });
  });

  describe('linkedBy', () => {
    it('should return reverse link', () => {
      const fooTable = new Table({
        tableName: 'foo',
        schema: () => ({
          ...schema,
        }),
      });
      const barTable = new Table({
        tableName: 'bar',
        schema: () => ({
          ...schema,
          fooId: fooTable.getForeignKey(),
        }),
      });

      const foo2bar = fooTable.linkedBy(barTable, 'fooId');
      expect(foo2bar).to.be.ok;
      expect(foo2bar.constructor).to.equal(Link);
      expect(foo2bar.left).to.deep.equal({
        table: barTable, field: 'fooId',
      });
      expect(foo2bar.right).to.deep.equal({
        table: fooTable, field: 'id',
      });
    });
  });

  describe('sync', () => {
    it('should ensure table & ensure index', async () => {
      await r.branch(r.tableList().contains('oneTable'), r.tableDrop('oneTable'), null).run(connection);
      await r.branch(r.tableList().contains('otherTable'), r.tableDrop('otherTable'), null).run(connection);
      const oneTable = new Table({
        tableName: 'oneTable',
        schema: () => ({
          ...schema,
          syncField: Joi.string().meta({ index: true }),
        }),
      });
      const otherTable = new Table({
        tableName: 'otherTable',
        schema: () => ({
          ...schema,
          syncId: oneTable.getForeignKey(),
        }),
      });
      await oneTable.sync(connection);
      await otherTable.sync(connection);

      expect(await r.tableList().contains('oneTable').run(connection)).to.be.true;
      expect(await r.tableList().contains('otherTable').run(connection)).to.be.true;
      expect(await r.table('oneTable').indexList().contains('syncField').run(connection)).to.be.true;
      expect(await r.table('otherTable').indexList().contains('syncId').run(connection)).to.be.true;
    });

    it('should ensure compound index', async () => {
      await r.branch(r.tableList().contains('syncTable'), r.tableDrop('syncTable'), null).run(connection);
      const syncTable = new Table({
        tableName: 'syncTable',
        schema: () => ({
          foo: Joi.string(),
          bar: Joi.string(),
        }),
        index: {
          foobar: [r.row('foo'), r.row('bar')],
        },
      });
      await syncTable.sync(connection);

      expect(await r.tableList().contains('syncTable').run(connection)).to.be.true;
      expect(await r.table('syncTable').indexList().contains('foobar').run(connection)).to.be.true;
    });
  });

  describe('query', () => {
    it('should return table query', async () => {
      const fooTable = new Table({
        tableName: 'foo',
        schema: () => ({
          ...schema,
        }),
      });
      await fooTable.sync(connection);

      const config = await fooTable.query().config().run(connection);
      expect(config).to.have.property('name', 'foo');
    });
  });

  describe('insert', () => {
    it('should insert data into database', async () => {
      const fooTable = new Table({
        tableName: 'foo',
        schema: () => ({
          ...schema,
          name: Joi.string().required(),
        }),
      });
      await fooTable.sync(connection);

      const foo = fooTable.attempt({ name: 'foo' });
      await fooTable.insert(foo).run(connection);
      const fetchedfoo = await fooTable.query().get(foo.id).run(connection);
      expect(foo).to.deep.equal(fetchedfoo);
    });
  });

  describe('get', () => {
    it('should get data from database', async () => {
      const fooTable = new Table({
        tableName: 'foo',
        schema: () => ({
          ...schema,
          name: Joi.string().required(),
        }),
      });
      await fooTable.sync(connection);

      const foo = fooTable.attempt({ name: 'foo' });
      await fooTable.insert(foo).run(connection);
      const fetchedfoo = await fooTable.get(foo.id).run(connection);
      expect(foo).to.deep.equal(fetchedfoo);
    });
  });

  describe('update', () => {
    let fooTable;

    before(async () => {
      fooTable = new Table({
        tableName: 'foo',
        schema: () => ({
          ...schema,
          name: Joi.string().required(),
        }),
      });
      await fooTable.sync(connection);
    });

    it('should update data into database', async () => {
      const foo = fooTable.create({ name: 'foo' });
      await fooTable.insert(foo).run(connection);
      const beforeUpdatedAt = foo.updatedAt;
      await fooTable.update(foo.id, { name: 'bar' }).run(connection);
      const fetchedfoo = await fooTable.get(foo.id).run(connection);
      expect(fetchedfoo).to.have.property('name', 'bar');
      expect(fetchedfoo.updatedAt.getTime()).to.not.equal(beforeUpdatedAt.getTime());
    });

    it('should update multiple rows', async () => {
      const foo = fooTable.create({ name: 'foo' });
      await fooTable.insert(foo).run(connection);
      const beforeUpdatedAt = foo.updatedAt;
      await fooTable.update([foo.id], { name: 'bar' }).run(connection);
      const fetchedfoo = await fooTable.get(foo.id).run(connection);
      expect(fetchedfoo).to.have.property('name', 'bar');
      expect(fetchedfoo.updatedAt.getTime()).to.not.equal(beforeUpdatedAt.getTime());
    });
  });

  describe('insert& update', () => {
    let fooTable;
    const EXIST_NAME = 'foo';
    const NEW_NAME = 'new';

    before(async () => {
      fooTable = new Table({
        tableName: 'foo',
        schema: () => ({
          ...schema,
          name: Joi.string().required().meta({ unique: true }),
        }),
      });
      await fooTable.sync(connection);
      await fooTable.query().delete().run(connection);

      const foo = fooTable.create({ name: EXIST_NAME });
      await fooTable.insert(foo).run(connection);
    });

    it('should throw error if data already exist', async () => {
      const foo1 = fooTable.create({ name: EXIST_NAME });
      await fooTable.insert(foo1).run(connection)
        .then(() => { throw new Error(); })
        .catch(() => {});

      const foo2 = fooTable.create({ name: NEW_NAME });
      await fooTable.insert(foo2).run(connection);
      await fooTable.update(foo2.id, { name: EXIST_NAME }).run(connection)
        .then(() => { throw new Error(); })
        .catch(() => {});
    });
  });

  describe('delete', () => {
    it('should delete data from database', async () => {
      const fooTable = new Table({
        tableName: 'foo',
        schema: () => ({
          ...schema,
          name: Joi.string().required(),
        }),
      });
      await fooTable.sync(connection);

      const foo = fooTable.attempt({ name: 'foo' });
      await fooTable.insert(foo).run(connection);
      await fooTable.delete(foo.id).run(connection);
      const fetchedfoo = await fooTable.query().get(foo.id).run(connection);
      expect(fetchedfoo).to.be.null;
    });
  });

  describe('relation - hasOne', () => {
    let fooTable;
    let barTable;

    before(async () => {
      fooTable = new Table({
        tableName: 'foo',
        schema: () => ({
          ...schema,
        }),
        relations: () => ({
          bar: hasOne(fooTable.linkedBy(barTable, 'fooId')),
        }),
      });
      barTable = new Table({
        tableName: 'bar',
        schema: () => ({
          ...schema,
          fooId: fooTable.getForeignKey(),
        }),
      });
      await fooTable.sync(connection);
      await barTable.sync(connection);
    });

    describe('withJoin & getRelated', async () => {
      it('should query relation', async () => {
        const foo = fooTable.create({});
        const bar = barTable.create({ fooId: foo.id });

        await fooTable.insert(foo).run(connection);
        await barTable.insert(bar).run(connection);

        let query = fooTable.get(foo.id);
        query = await fooTable.withJoin(query, { bar: true });
        const fetchedfoo = await query.run(connection);
        expect(bar).to.deep.equal(fetchedfoo.bar);

        const fetchedBar = await fooTable.getRelated(foo.id, 'bar').run(connection);
        expect(bar).to.deep.equal(fetchedBar);
      });
    });

    describe('createRelation', async () => {
      it('should add relation', async () => {
        const foo = fooTable.create({});
        const bar = barTable.create({});

        await fooTable.insert(foo).run(connection);
        await barTable.insert(bar).run(connection);

        await fooTable.createRelation('bar', foo.id, bar.id).run(connection);

        const fetchedBar = await fooTable.getRelated(foo.id, 'bar').run(connection);
        expect(fetchedBar.id).to.equal(bar.id);
      });
    });

    describe('removeRelation', async () => {
      it('should remove relation', async () => {
        const foo = fooTable.create({});
        const bar = barTable.create({});

        await fooTable.insert(foo).run(connection);
        await barTable.insert(bar).run(connection);

        await fooTable.createRelation('bar', foo.id, bar.id).run(connection);
        await fooTable.removeRelation('bar', foo.id, bar.id).run(connection);

        const fetchedBar = await fooTable.getRelated(foo.id, 'bar').run(connection);
        expect(fetchedBar).to.be.null;
      });
    });

    describe('hasRelation', () => {
      it('should check relation', async () => {
        const foo = fooTable.create({});
        const bar = barTable.create({});

        await fooTable.insert(foo).run(connection);
        await barTable.insert(bar).run(connection);

        expect(
          await fooTable.hasRelation('bar', foo.id, bar.id).run(connection)
        ).to.be.false;

        await fooTable.createRelation('bar', foo.id, bar.id).run(connection);

        expect(
          await fooTable.hasRelation('bar', foo.id, bar.id).run(connection)
        ).to.be.true;
      });
    });
  });

  describe('relation - belongsTo', () => {
    let fooTable;
    let barTable;

    before(async () => {
      fooTable = new Table({
        tableName: 'foo',
        schema: () => ({
          ...schema,
          barId: barTable.getForeignKey(),
        }),
        relations: () => ({
          bar: belongsTo(fooTable.linkTo(barTable, 'barId')),
        }),
      });
      barTable = new Table({
        tableName: 'bar',
        schema: () => ({
          ...schema,
        }),
      });
      await fooTable.sync(connection);
      await barTable.sync(connection);
    });

    describe('withJoin & getRelated', () => {
      it('should query relation', async () => {
        const bar = barTable.create({});
        const foo = fooTable.create({ barId: bar.id });

        await fooTable.insert(foo).run(connection);
        await barTable.insert(bar).run(connection);

        let query = fooTable.get(foo.id);
        query = fooTable.withJoin(query, { bar: true });
        const fetchedfoo = await query.run(connection);
        expect(bar).to.deep.equal(fetchedfoo.bar);

        const fetchedBar = await fooTable.getRelated(foo.id, 'bar').run(connection);
        expect(bar).to.deep.equal(fetchedBar);
      });
    });

    describe('createRelation', () => {
      it('should add relation', async () => {
        const bar = barTable.create({});
        const foo = fooTable.create({});

        await fooTable.insert(foo).run(connection);
        await barTable.insert(bar).run(connection);

        await fooTable.createRelation('bar', foo.id, bar.id).run(connection);

        const fetchedBar = await fooTable.getRelated(foo.id, 'bar').run(connection);
        expect(fetchedBar.id).to.equal(bar.id);
      });
    });

    describe('removeRelation', () => {
      it('should remove relation', async () => {
        const bar = barTable.create({});
        const foo = fooTable.create({});

        await fooTable.insert(foo).run(connection);
        await barTable.insert(bar).run(connection);

        await fooTable.createRelation('bar', foo.id, bar.id).run(connection);
        await fooTable.removeRelation('bar', foo.id, bar.id).run(connection);

        const fetchedBar = await fooTable.getRelated(foo.id, 'bar').run(connection);
        expect(fetchedBar).to.be.null;
      });
    });

    describe('hasRelation', () => {
      it('should check relation', async () => {
        const foo = fooTable.create({});
        const bar = barTable.create({});

        await fooTable.insert(foo).run(connection);
        await barTable.insert(bar).run(connection);

        expect(
          await fooTable.hasRelation('bar', foo.id, bar.id).run(connection)
        ).to.be.false;

        await fooTable.createRelation('bar', foo.id, bar.id).run(connection);

        expect(
          await fooTable.hasRelation('bar', foo.id, bar.id).run(connection)
        ).to.be.true;
      });
    });
  });

  describe('relation - hasMany', () => {
    let fooTable;
    let barTable;

    before(async () => {
      fooTable = new Table({
        tableName: 'foo',
        schema: () => ({
          ...schema,
        }),
        relations: () => ({
          bars: hasMany(fooTable.linkedBy(barTable, 'fooId')),
        }),
      });
      barTable = new Table({
        tableName: 'bar',
        schema: () => ({
          ...schema,
          fooId: fooTable.getForeignKey(),
        }),
      });
      await fooTable.sync(connection);
      await barTable.sync(connection);
    });

    describe('withJoin & getRelated', () => {
      it('should query relation', async () => {
        const foo = fooTable.create({});
        const bar = barTable.create({ fooId: foo.id });

        await fooTable.insert(foo).run(connection);
        await barTable.insert(bar).run(connection);

        let query = fooTable.get(foo.id);
        query = fooTable.withJoin(query, { bars: true });
        const fetchedfoo = await query.run(connection);
        expect(fetchedfoo.bars).to.have.length(1);
        expect(bar).to.deep.equal(fetchedfoo.bars[0]);

        const fetchedBars = await fooTable.getRelated(foo.id, 'bars').run(connection);
        expect(fetchedBars).to.have.length(1);
        expect(bar).to.deep.equal(fetchedBars[0]);
      });
    });

    describe('createRelation', () => {
      it('should add relation', async () => {
        const foo = fooTable.create({});
        const bar = barTable.create({});
        await fooTable.insert(foo).run(connection);
        await barTable.insert(bar).run(connection);

        await fooTable.createRelation('bars', foo.id, bar.id).run(connection);

        const fetchedBars = await fooTable.getRelated(foo.id, 'bars').run(connection);
        expect(fetchedBars).to.have.length(1);
        expect(fetchedBars[0]).to.have.property('id', bar.id);
        expect(fetchedBars[0]).to.have.property('fooId', foo.id);
      });
    });

    describe('removeRelation', () => {
      it('should remove relation', async () => {
        const foo = fooTable.create({});
        const bar1 = barTable.create({});
        const bar2 = barTable.create({});
        await fooTable.insert(foo).run(connection);
        await barTable.insert(bar1).run(connection);
        await barTable.insert(bar2).run(connection);
        await fooTable.createRelation('bars', foo.id, bar1.id).run(connection);
        await fooTable.createRelation('bars', foo.id, bar2.id).run(connection);

        await fooTable.removeRelation('bars', foo.id, bar1.id).run(connection);

        const fetchedBars = await fooTable.getRelated(foo.id, 'bars').run(connection);
        expect(fetchedBars).to.have.length(1);
        expect(fetchedBars[0].id).to.equal(bar2.id);
      });

      it('should remove relations with array', async () => {
        const foo = fooTable.create({});
        const bar1 = barTable.create({});
        const bar2 = barTable.create({});
        await fooTable.insert(foo).run(connection);
        await barTable.insert(bar1).run(connection);
        await barTable.insert(bar2).run(connection);
        await fooTable.createRelation('bars', foo.id, bar1.id).run(connection);
        await fooTable.createRelation('bars', foo.id, bar2.id).run(connection);

        await fooTable.removeRelation('bars', foo.id, [bar1.id]).run(connection);

        const fetchedBars = await fooTable.getRelated(foo.id, 'bars').run(connection);
        expect(fetchedBars).to.have.length(1);
        expect(fetchedBars[0].id).to.equal(bar2.id);
      });
    });

    describe('hasRelation', () => {
      it('should check relation', async () => {
        const foo = fooTable.create({});
        const bar = barTable.create({});
        await fooTable.insert(foo).run(connection);
        await barTable.insert(bar).run(connection);

        expect(
          await fooTable.hasRelation('bars', foo.id, bar.id).run(connection)
        ).to.be.false;

        await fooTable.createRelation('bars', foo.id, bar.id).run(connection);

        expect(
          await fooTable.hasRelation('bars', foo.id, bar.id).run(connection)
        ).to.be.true;
      });
    });
  });

  describe('relation - belongsToMany', () => {
    let fooTable;
    let barTable;
    let foobarTable;
    let followingTable;

    before(async () => {
      fooTable = new Table({
        tableName: 'foo',
        schema: () => ({
          ...schema,
        }),
        relations: () => ({
          bars: belongsToMany([
            fooTable.linkedBy(foobarTable, 'fooId'),
            foobarTable.linkTo(barTable, 'barId'),
          ], { index: 'foobar' }),
          following: belongsToMany([
            fooTable.linkedBy(followingTable, 'followerId'),
            followingTable.linkTo(fooTable, 'followeeId'),
          ], { index: 'following' }),
          followers: belongsToMany([
            fooTable.linkedBy(followingTable, 'followeeId'),
            followingTable.linkTo(fooTable, 'followerId'),
          ], { index: 'followers' }),
        }),
      });
      barTable = new Table({
        tableName: 'bar',
        schema: () => ({
          ...schema,
        }),
        relations: () => ({
          foos: belongsToMany([
            barTable.linkedBy(foobarTable, 'barId'),
            foobarTable.linkTo(fooTable, 'fooId'),
          ], { index: 'foobar' }),
        }),
      });
      foobarTable = new Table({
        tableName: 'foobar',
        schema: () => ({
          ...schema,
          fooId: fooTable.getForeignKey({ isManyToMany: true }),
          barId: barTable.getForeignKey({ isManyToMany: true }),
        }),
        index: {
          foobar: [r.row('fooId'), r.row('barId')],
        },
      });
      followingTable = new Table({
        tableName: 'following',
        schema: () => ({
          ...schema,
          followerId: fooTable.getForeignKey({ isManyToMany: true }),
          followeeId: fooTable.getForeignKey({ isManyToMany: true }),
        }),
        index: {
          following: [r.row('followerId'), r.row('followeeId')],
          followers: [r.row('followeeId'), r.row('followerId')],
        },
      });
      await fooTable.sync(connection);
      await barTable.sync(connection);
      await foobarTable.sync(connection);
      await followingTable.sync(connection);
    });

    beforeEach(async () => {
      await fooTable.query().delete().run(connection);
      await barTable.query().delete().run(connection);
      await foobarTable.query().delete().run(connection);
      await followingTable.query().delete().run(connection);
    });

    describe('withJoin & getRelated', () => {
      it('should query relation', async () => {
        const foo = fooTable.create({});
        const bar = barTable.create({});
        const foobar = foobarTable.create({ fooId: foo.id, barId: bar.id });

        await fooTable.insert(foo).run(connection);
        await barTable.insert(bar).run(connection);
        await foobarTable.insert(foobar).run(connection);

        let query = fooTable.get(foo.id);
        query = fooTable.withJoin(query, { bars: true });
        const fetchedfoo = await query.run(connection);
        expect(fetchedfoo.bars).to.have.length(1);
        expect(bar).to.deep.equal(fetchedfoo.bars[0]);

        const fetchedBars = await fooTable.getRelated(foo.id, 'bars').run(connection);
        expect(fetchedBars).to.have.length(1);
        expect(bar).to.deep.equal(fetchedBars[0]);

        query = barTable.get(bar.id);
        query = barTable.withJoin(query, { foos: true });
        const fetchedbarTable = await query.run(connection);
        expect(fetchedbarTable.foos).to.have.length(1);
        expect(foo).to.deep.equal(fetchedbarTable.foos[0]);

        const fetchedFoos = await barTable.getRelated(bar.id, 'foos').run(connection);
        expect(fetchedFoos).to.have.length(1);
        expect(foo).to.deep.equal(fetchedFoos[0]);
      });
    });

    describe('createRelation', () => {
      it('should add relation', async () => {
        const foo = fooTable.create({});
        const bar = barTable.create({});
        await fooTable.insert(foo).run(connection);
        await barTable.insert(bar).run(connection);

        await fooTable.createRelation('bars', foo.id, bar.id).run(connection);

        const fetchedBars = await fooTable.getRelated(foo.id, 'bars').run(connection);
        expect(fetchedBars).to.have.length(1);
        expect(fetchedBars[0]).to.have.property('id', bar.id);

        const fetchedFoos = await barTable.getRelated(bar.id, 'foos').run(connection);
        expect(fetchedFoos).to.have.length(1);
        expect(fetchedFoos[0]).to.have.property('id', foo.id);
      });

      it('should add relations with array', async () => {
        const foo = fooTable.create({});
        const bar = barTable.create({});
        await fooTable.insert(foo).run(connection);
        await barTable.insert(bar).run(connection);

        await fooTable.createRelation('bars', foo.id, [bar.id]).run(connection);

        const fetchedBars = await fooTable.getRelated(foo.id, 'bars').run(connection);
        expect(fetchedBars).to.have.length(1);
        expect(fetchedBars[0]).to.have.property('id', bar.id);

        const fetchedFoos = await barTable.getRelated(bar.id, 'foos').run(connection);
        expect(fetchedFoos).to.have.length(1);
        expect(fetchedFoos[0]).to.have.property('id', foo.id);
      });
    });

    describe('removeRelation', () => {
      it('should remove relation', async () => {
        const foo = fooTable.create({});
        const bar1 = barTable.create({});
        const bar2 = barTable.create({});
        await fooTable.insert(foo).run(connection);
        await barTable.insert(bar1).run(connection);
        await barTable.insert(bar2).run(connection);
        await fooTable.createRelation('bars', foo.id, bar1.id).run(connection);
        await fooTable.createRelation('bars', foo.id, bar2.id).run(connection);

        await fooTable.removeRelation('bars', foo.id, bar1.id).run(connection);

        const fetchedBars = await fooTable.getRelated(foo.id, 'bars').run(connection);
        expect(fetchedBars).to.have.length(1);
        expect(fetchedBars[0].id).to.equal(bar2.id);

        const fetchedFoos = await barTable.getRelated(bar2.id, 'foos').run(connection);
        expect(fetchedFoos).to.have.length(1);
        expect(fetchedFoos[0].id).to.equal(foo.id);
      });

      it('should remove relations with array', async () => {
        const foo = fooTable.create({});
        const bar1 = barTable.create({});
        const bar2 = barTable.create({});
        await fooTable.insert(foo).run(connection);
        await barTable.insert(bar1).run(connection);
        await barTable.insert(bar2).run(connection);
        await fooTable.createRelation('bars', foo.id, bar1.id).run(connection);
        await fooTable.createRelation('bars', foo.id, bar2.id).run(connection);

        await fooTable.removeRelation('bars', foo.id, [bar1.id]).run(connection);

        const fetchedBars = await fooTable.getRelated(foo.id, 'bars').run(connection);
        expect(fetchedBars).to.have.length(1);
        expect(fetchedBars[0].id).to.equal(bar2.id);

        const fetchedFoos = await barTable.getRelated(bar2.id, 'foos').run(connection);
        expect(fetchedFoos).to.have.length(1);
        expect(fetchedFoos[0].id).to.equal(foo.id);
      });
    });

    describe('hasRelation', () => {
      it('should check relation', async () => {
        const foo = fooTable.create({});
        const bar = barTable.create({});
        await fooTable.insert(foo).run(connection);
        await barTable.insert(bar).run(connection);

        expect(
          await fooTable.hasRelation('bars', foo.id, bar.id).run(connection)
        ).to.be.false;

        await fooTable.createRelation('bars', foo.id, bar.id).run(connection);

        expect(
          await fooTable.hasRelation('bars', foo.id, bar.id).run(connection)
        ).to.be.true;
      });

      it('should check relations with array', async () => {
        const foo = fooTable.create({});
        const bar = barTable.create({});
        await fooTable.insert(foo).run(connection);
        await barTable.insert(bar).run(connection);

        expect(
          await fooTable.hasRelation('bars', foo.id, [bar.id]).run(connection)
        ).to.be.false;

        await fooTable.createRelation('bars', foo.id, bar.id).run(connection);

        expect(
          await fooTable.hasRelation('bars', foo.id, [bar.id]).run(connection)
        ).to.be.true;
      });

      it('should check relations with same table', async () => {
        const follower = fooTable.create({});
        const followee = fooTable.create({});
        await fooTable.insert([follower, followee]).run(connection);

        expect(
          await fooTable.hasRelation('following', follower.id, followee.id).run(connection)
        ).to.be.false;

        await fooTable.createRelation('following', follower.id, followee.id).run(connection);

        expect(
          await fooTable.hasRelation('following', follower.id, followee.id).run(connection)
        ).to.be.true;
        expect(
          await fooTable.hasRelation('followers', follower.id, follower.id).run(connection)
        ).to.be.false;

        expect(
          await fooTable.hasRelation('followers', followee.id, follower.id).run(connection)
        ).to.be.true;
        expect(
          await fooTable.hasRelation('following', followee.id, follower.id).run(connection)
        ).to.be.false;
      });
    });
  });

  describe('relation - compound', () => {
    describe('withJoin & getRelated', () => {
      let fooTable;
      let barTable;
      let bazTable;

      before(async () => {
        fooTable = new Table({
          tableName: 'foo',
          schema: () => ({
            ...schema,
          }),
          relations: () => ({
            bar: hasOne(fooTable.linkedBy(barTable, 'fooId')),
          }),
        });
        barTable = new Table({
          tableName: 'bar',
          schema: () => ({
            ...schema,
            fooId: fooTable.getForeignKey(),
          }),
          relations: () => ({
            baz: hasOne(barTable.linkedBy(bazTable, 'barId')),
          }),
        });
        bazTable = new Table({
          tableName: 'baz',
          schema: () => ({
            ...schema,
            barId: barTable.getForeignKey(),
          }),
        });
        await fooTable.sync(connection);
        await barTable.sync(connection);
        await bazTable.sync(connection);
      });

      it('should query nested relation', async () => {
        const foo = fooTable.create({});
        const bar = barTable.create({ fooId: foo.id });
        const baz = bazTable.create({ barId: bar.id });

        await fooTable.insert(foo).run(connection);
        await barTable.insert(bar).run(connection);
        await bazTable.insert(baz).run(connection);

        let query = fooTable.get(foo.id);
        query = await fooTable.withJoin(query, { bar: { baz: true } });
        const result = await query.run(connection);
        expect(result).to.deep.equal({
          ...foo,
          bar: {
            ...bar,
            baz,
          },
        });
      });

      it('should query nested relation with empty part', async () => {
        const foo = fooTable.create({});

        await fooTable.insert(foo).run(connection);

        let query = fooTable.get(foo.id);
        query = await fooTable.withJoin(query, { bar: { baz: true } });
        const result = await query.run(connection);
        expect(result).to.deep.equal({
          ...foo,
          bar: null,
        });
      });
    });
  });
});
