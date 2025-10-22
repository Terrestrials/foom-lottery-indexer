import { HttpStatus, Injectable, OnModuleInit } from '@nestjs/common'

import Moralis from 'moralis'
import { OpenAI } from 'openai'
import { isLocal } from 'src/utils/environment'
import { generateUUID } from 'src/utils/uuid'

import { writeFile } from 'fs/promises';
import { join } from 'path';
import { UserAddressConnection } from 'src/schemas/userConnection.schema'
import { Model } from 'mongoose'
import { InjectModel } from '@nestjs/mongoose'

/**
 * Zapisuje tablicę jako string do pliku result.json
 * @param data - dowolna tablica (np. z transakcjami)
 */
export async function saveArrayToFile(data: any[]): Promise<void> {
  const filePath = join(__dirname, '..', 'result.json');
  const jsonString = JSON.stringify(data, null, 2); // Ładnie sformatowany JSON

  try {
    await writeFile(filePath, jsonString, 'utf-8');
    console.log(`Plik zapisany: ${filePath}`);
  } catch (error) {
    console.error('Błąd zapisu pliku:', error);
    throw error;
  }
}


@Injectable()
export class CoreService  {
  constructor(
    @InjectModel(UserAddressConnection.name)
    private readonly userAddressConnectionModel: Model<UserAddressConnection>,
  ) {

  }

  getStatus(): object {
    const sh = require('child_process').execSync

    return {
      status: HttpStatus.OK,
      id: {
        patch: `https://github.com/hashup-it/foom-lottery-indexer/commit/${isLocal()
            ? `${process.env.GIT_COMMIT}${!!sh('git status --porcelain').toString().trim()
              ? ` (dirty)`
              : ''
            }`
            : process.env.GIT_COMMIT
          }`,
        runtime: generateUUID(),
      },
    }
  }
}
