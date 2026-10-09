package co.qrspace.app.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

/** One scan, kept only on this phone. */
@Entity(tableName = "scans")
data class ScanEntry(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val raw: String,
    /** CodeFormat name. */
    val format: String,
    val at: Long,
)

@Dao
interface ScanDao {
    @Query("SELECT * FROM scans ORDER BY at DESC LIMIT 500")
    fun all(): Flow<List<ScanEntry>>

    @Query("SELECT * FROM scans ORDER BY at DESC LIMIT 1")
    suspend fun last(): ScanEntry?

    @Insert
    suspend fun insert(e: ScanEntry): Long

    @Query("UPDATE scans SET at = :at WHERE id = :id")
    suspend fun touch(id: Long, at: Long)

    @Query("DELETE FROM scans WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("DELETE FROM scans")
    suspend fun clear()
}

@Database(entities = [ScanEntry::class], version = 1, exportSchema = true)
abstract class HistoryDb : RoomDatabase() {
    abstract fun scans(): ScanDao

    companion object {
        fun create(context: Context) = Room.databaseBuilder(context, HistoryDb::class.java, "history.db").build()
    }
}

/** Saves a scan; the same value scanned again right after only refreshes its time (no duplicates). */
suspend fun ScanDao.record(raw: String, format: String) {
    val now = System.currentTimeMillis()
    val prev = last()
    if (prev != null && prev.raw == raw) touch(prev.id, now) else insert(ScanEntry(raw = raw, format = format, at = now))
}
